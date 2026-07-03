/**
 * Credit-Based Pay-as-you-go System
 * Users buy credit upfront, consume per generation
 */

import { supabase, isSupabaseConfigured } from '../supabase/supabaseClient';
import { logger } from '../../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CreditPackage {
  id: string;
  amount: number; // USD
  credits: number; // Credit units
  bonus: number; // Bonus credits
  popular?: boolean;
}

export interface UserCredit {
  userId: string;
  balance: number; // Available credits
  totalPurchased: number;
  totalUsed: number;
  lastPurchaseAt?: string;
  expiresAt?: string; // Optional expiry
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  amount: number; // Credits added/removed
  balanceAfter: number;
  description: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

// ── Credit Packages ───────────────────────────────────────────────────────────

export const CREDIT_PACKAGES: CreditPackage[] = [
  // $1 = 10 credits (1 credit = $0.10)
  { id: 'p10',   amount: 10,   credits: 100,   bonus: 5 },    // $10  = 105 credits
  { id: 'p20',   amount: 20,   credits: 200,   bonus: 15 },   // $20  = 215 credits
  { id: 'p50',   amount: 50,   credits: 500,   bonus: 50 },   // $50  = 550 credits
  { id: 'p100',  amount: 100,  credits: 1000,  bonus: 150 },  // $100 = 1150 credits
  { id: 'p1000', amount: 1000, credits: 10000, bonus: 2500 }, // $1000= 12500 credits
  { id: 'custom', amount: 0, credits: 0, bonus: 0 },          // Custom amount (min $5)
];

// ── Cost Per Operation (Based on Replicate Pricing) ────────────────────────────
// 1 Credit = $0.10 USD  |  Markup: 1.5× on actual API cost (50% profit margin)
//
// Formula: credits = ceil(actual_cost_usd / 0.10 * 1.5)
//
// Per-model costs (credits):
//   Nano Banana 2  1K → 2  |  2K → 2  |  4K → 3
//   Nano Banana Pro 1K/2K → 3  |  4K → 5  |  fallback → 1
//   Seedream 4.5        → 1
//   FLUX 2 Pro          → 1
//   FLUX Kontext Pro    → 1
//   GPT Image 2 low → 1  |  medium → 1  |  auto/high → 2
//   Grok Imagine        → 1
//   Stable Diffusion 3.5 → 1  ($0.065 actual, $0.10 charged = 54% margin)
//   Topaz Upscale       → 2
//   Real-ESRGAN         → 1
//   Clarity Upscaler    → 1
//   P Image Upscale 1-4MP → 1 | 4-8MP → 1 | 8-16MP → 1 | 16-32MP → 1 | 32-64MP → 1 | 64-128MP → 2

// Old costs (Trial)
export const TRIAL_GENERATION_COST = {
  standard: 1,
  hd: 2,
  '4k': 3,
  video480: 14,
  video720: 38,
  upscale: 2,
  chat: 1,
};

// Paid costs (Stripe 10% fee + 35% profit margin = 55% budget ratio)
// Formula: credits = roundTo(actual_cost / 0.055, 2)
export const PAID_GENERATION_COST = {
  standard: 0.91,    // $0.05 / 0.055 = 0.91
  hd: 1.82,          // $0.10 / 0.055 = 1.82
  '4k': 2.75,        // $0.151 / 0.055 = 2.75
  video480: 1.64,    // $0.09 / 0.055 = 1.64
  video720: 4.55,    // $0.25 / 0.055 = 4.55
  upscale: 1.45,     // $0.08 / 0.055 = 1.45
  chat: 0.18,        // $0.01 / 0.055 = 0.18
};

// Backwards compatibility default reference
export const GENERATION_COST = TRIAL_GENERATION_COST;

// ── Per-model cost lookup ─────────────────────────────────────────────────────
// resolution param: aiConfig.resolution  e.g. '1024x1024', '2048x2048', '4096x4096'
// qualityVariant param: aiConfig.stylePreset or gpt quality field  e.g. 'low'|'medium'|'high'|'auto'
// prunaTarget param: aiConfig.prunaTarget (megapixels)

export interface ModelCostParams {
  resolution?: string;       // e.g. '1024x1024'
  qualityVariant?: string;   // GPT Image 2: 'low' | 'medium' | 'high' | 'auto'
  prunaTarget?: number;      // P Image Upscale target megapixels
  upscaleFactor?: number;    // upscale factor e.g. 2, 4, 6, 8, 12
  isTrial?: boolean;         // check if user is on trial mode
}

// ── Per-model helpers (keep each helper ≤ 5 branches) ───────────────────────

function resolveResPixels(resolution: string): number {
  const [w, h] = resolution.split('x').map(Number);
  return (w && h) ? w * h : 0;
}

function costNanaBanana2(resolution: string, px: number, isTrial: boolean): number {
  if (isTrial) {
    if (px >= 4096 * 4096 || resolution.includes('4K')) return 3;
    if (px >= 2048 * 2048 || resolution.includes('2K')) return 2;
    return 2;
  } else {
    // Paid rates: 1K = 1.4, 2K = 1.5, 4K = 2.5
    if (px >= 4096 * 4096 || resolution.includes('4K')) return 2.5;
    if (px >= 2048 * 2048 || resolution.includes('2K')) return 1.5;
    return 1.4;
  }
}

function costNanaBananaPro(resolution: string, px: number, isTrial: boolean): number {
  if (isTrial) {
    if (px >= 4096 * 4096 || resolution.includes('4K')) return 5;
    if (px >= 1024 * 1024 || resolution.includes('1K') || resolution.includes('2K')) return 3;
    return 1;
  } else {
    // Paid rates: 1K = 2.2, 2K = 2.5, 4K = 3.5
    if (px >= 4096 * 4096 || resolution.includes('4K')) return 3.5;
    if (px >= 2048 * 2048 || resolution.includes('2K')) return 2.5;
    return 2.2;
  }
}

function costSeedream4_5(resolution: string, px: number, isTrial: boolean): number {
  if (isTrial) {
    return 1;
  } else {
    // Paid rates: 2K = 1.0, 4K = 1.5
    if (px >= 4096 * 4096 || resolution.includes('4K')) return 1.5;
    return 1.0;
  }
}

function costFlux2Pro(resolution: string, px: number, isTrial: boolean): number {
  if (isTrial) {
    return 1;
  } else {
    // Paid rates: 0.5K = 0.5, 1K = 1.2, 2K = 1.6, 4K = 2.0
    if (px >= 4096 * 4096 || resolution.includes('4K')) return 2.0;
    if (px >= 2048 * 2048 || resolution.includes('2K')) return 1.6;
    if (px >= 1024 * 1024 || resolution.includes('1K')) return 1.2;
    if (px <= 512 * 512 || resolution.includes('512') || resolution.includes('0.5K')) return 0.5;
    return 1.0; // standard 1K fallback
  }
}

function costGptImage2(qualityVariant: string, isTrial: boolean): number {
  if (isTrial) {
    if (qualityVariant === 'low')    return 1;
    if (qualityVariant === 'medium') return 1;
    return 2; // auto / high
  } else {
    // Paid rates: auto = 2.0, low/medium/high = 2.0
    return 2.0;
  }
}

function costPrunaUpscale(prunaTarget: number = 4, isTrial: boolean): number {
  if (isTrial) {
    if (prunaTarget <= 32) return 1;
    return 2;   // 32-128MP
  } else {
    // Paid rates: 4 MP = 0.2, 8 MP = 0.4, 16 MP = 0.6, 32 MP = 0.8, 64 MP = 1.25, 128 MP = 2.5
    const mp = prunaTarget;
    if (mp <= 4)   return 0.2;
    if (mp <= 8)   return 0.4;
    if (mp <= 16)  return 0.6;
    if (mp <= 32)  return 0.8;
    if (mp <= 64)  return 1.25;
    return 2.5; // 64-128MP
  }
}

function costTopazUpscale(upscaleFactor: number = 2, isTrial: boolean): number {
  if (isTrial) {
    return 2.0;
  } else {
    // 2x & 4x = 1.45, 6x = 1.8
    if (upscaleFactor >= 6) return 1.8;
    return 1.45;
  }
}

function costClarityUpscale(upscaleFactor: number = 2, isTrial: boolean): number {
  if (isTrial) {
    return 1.0;
  } else {
    // 2x & 4x = 1, 8x = 1.25, 12x = 2
    if (upscaleFactor >= 12) return 2.0;
    if (upscaleFactor >= 8)  return 1.25;
    return 1.0;
  }
}

// ── Flat cost table for simple models ────────────────────────────────────────
const TRIAL_FLAT_MODEL_COSTS: Record<string, number> = {
  'bytedance/seedream-4.5':                        1,
  'black-forest-labs/flux-2-pro':                  1,
  'black-forest-labs/flux-kontext-pro':            1,
  'xai/grok-imagine-image':                        1,
  'stability-ai/stable-diffusion-3.5-large':       1,
  'topazlabs/image-upscale':                       2,
  'philz1337x/clarity-upscaler':                   1,
};

const PAID_FLAT_MODEL_COSTS: Record<string, number> = {
  'black-forest-labs/flux-kontext-pro':            1.0,
  'xai/grok-imagine-image':                        1.0,
  'stability-ai/stable-diffusion-3.5-large':       1.18, // $0.065 / 0.055
};

export function getModelCost(model: string, params: ModelCostParams = {}): number {
  const { resolution = '', qualityVariant = 'auto', prunaTarget, upscaleFactor, isTrial = true } = params;
  const px = resolveResPixels(resolution);

  if (model === 'google/nano-banana-2')   return costNanaBanana2(resolution, px, isTrial);
  if (model === 'google/nano-banana-pro') return costNanaBananaPro(resolution, px, isTrial);
  if (model === 'openai/gpt-image-2')     return costGptImage2(qualityVariant, isTrial);
  if (model === 'bytedance/seedream-4.5')   return costSeedream4_5(resolution, px, isTrial);
  if (model === 'black-forest-labs/flux-2-pro') return costFlux2Pro(resolution, px, isTrial);
  if (model === 'prunaai/p-image-upscale') return costPrunaUpscale(prunaTarget, isTrial);
  if (model === 'topazlabs/image-upscale') return costTopazUpscale(upscaleFactor, isTrial);
  if (model === 'philz1337x/clarity-upscaler') return costClarityUpscale(upscaleFactor, isTrial);
  
  if (isTrial) {
    return TRIAL_FLAT_MODEL_COSTS[model] ?? TRIAL_GENERATION_COST.standard;
  } else {
    return PAID_FLAT_MODEL_COSTS[model] ?? PAID_GENERATION_COST.standard;
  }
}

// Credit value: $1 = 100 credits
// $5 package = 500 credits
// $10 package = 1000 credits

// ── Development Mode ───────────────────────────────────────────────────────────
// Set to true to bypass credit checks during development
// Set to false to enforce credit system for production
export const DEV_MODE = false;

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Get user credit balance
 */
export async function getUserCredit(userId: string): Promise<UserCredit | null> {
  if (!isSupabaseConfigured) {
    return {
      userId,
      balance: 1000,
      totalPurchased: 1000,
      totalUsed: 0,
      lastPurchaseAt: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error?.code === 'PGRST116') {
    // No record, create with 0 balance
    return createUserCredit(userId);
  }

  if (error) {
    logger.error('[Credit] Failed to get credit:', error);
    return null;
  }

  return data ? mapDbToUserCredit(data) : null;
}

/**
 * Create initial credit record
 */
async function createUserCredit(userId: string): Promise<UserCredit | null> {
  const { data, error } = await supabase
    .from('user_credits')
    .insert({
      user_id: userId,
      balance: 20,
      total_purchased: 0,
      total_used: 0,
    })
    .select()
    .single();

  if (error) {
    logger.error('[Credit] Failed to create credit record:', error);
    return null;
  }

  return data ? mapDbToUserCredit(data) : null;
}

export async function addCredits(
  userId: string,
  credits: number,
  amountUsd: number,
  _paymentId?: string
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return true;
  }

  const { error: rpcError } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_credits: credits,
    p_description: `Purchased ${credits} credits for $${amountUsd}`,
  });

  if (rpcError) {
    logger.error('[Credit] Failed to add credits:', rpcError);
    return false;
  }

  return true;
}

export async function deductCredits(
  userId: string,
  cost: number,
  description: string
): Promise<{ success: boolean; remaining: number; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: true, remaining: 1000 - cost };
  }

  // Use the atomic RPC to prevent double-spend race conditions
  const { data: rpcData, error: rpcError } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: cost,
    p_description: description,
  });

  if (rpcError) {
    logger.error('[Credit] RPC deduct_credits failed:', rpcError);
    return { success: false, remaining: 0, error: rpcError.message || 'Deduction failed' };
  }

  const newBalance = typeof rpcData === 'number' ? rpcData : 0;
  return { success: true, remaining: newBalance };
}

/**
 * Check if user has enough credits
 */
export async function checkCreditBalance(
  userId: string,
  cost?: number
): Promise<{ hasEnough: boolean; balance: number; needed: number }> {
  const credit = await getUserCredit(userId);
  if (!credit) {
    const defaultCost = GENERATION_COST.standard;
    return { hasEnough: false, balance: 0, needed: defaultCost };
  }

  const isTrial = credit.totalPurchased === 0;
  const resolvedCost = cost !== undefined ? cost : (isTrial ? TRIAL_GENERATION_COST.standard : PAID_GENERATION_COST.standard);

  return {
    hasEnough: credit.balance >= resolvedCost,
    balance: credit.balance,
    needed: resolvedCost,
  };
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  if (!isSupabaseConfigured) {
    return [
      {
        id: 't_mock_1',
        userId,
        type: 'bonus',
        amount: 1000,
        balanceAfter: 1000,
        description: 'Welcome Bonus Credits (Mock)',
        createdAt: new Date().toISOString(),
      }
    ];
  }

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[Credit] Failed to get transactions:', error);
    return [];
  }

  return (data || []).map(mapDbToTransaction);
}

export async function refundCredits(
  userId: string,
  credits: number,
  description: string
): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return true;
  }

  const { error: rpcError } = await supabase.rpc('refund_credits', {
    p_user_id: userId,
    p_amount: credits,
    p_description: description,
  });

  if (rpcError) {
    logger.error('[Credit] Failed to refund credits via RPC:', rpcError);
    return false;
  }

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────


function mapDbToUserCredit(data: any): UserCredit {
  return {
    userId: data.user_id,
    balance: data.balance,
    totalPurchased: data.total_purchased,
    totalUsed: data.total_used,
    lastPurchaseAt: data.last_purchase_at,
    expiresAt: data.expires_at,
  };
}

function mapDbToTransaction(data: any): CreditTransaction {
  return {
    id: data.id,
    userId: data.user_id,
    type: data.type,
    amount: data.amount,
    balanceAfter: data.balance_after,
    description: data.description,
    createdAt: data.created_at,
    metadata: data.metadata,
  };
}

// ── Local Cache ──────────────────────────────────────────────────────────────

const CREDIT_CACHE_KEY = 'anarchy_credit_cache';

export function cacheCreditBalance(balance: number): void {
  try {
    localStorage.setItem(CREDIT_CACHE_KEY, JSON.stringify({
      balance,
      timestamp: Date.now(),
    }));
  } catch {
    // ignore
  }
}

export function getCachedCreditBalance(): number | null {
  try {
    const data = localStorage.getItem(CREDIT_CACHE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    // Cache valid for 5 minutes
    if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
      return parsed.balance;
    }
    return null;
  } catch {
    return null;
  }
}
