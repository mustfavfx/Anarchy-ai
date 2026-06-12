/**
 * Credit-Based Pay-as-you-go System
 * Users buy credit upfront, consume per generation
 */

import { supabase } from '../supabase/supabaseClient';
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

// Legacy flat costs (kept for Video / Chat which still use them)
export const GENERATION_COST = {
  standard: 1,     // default fallback
  hd: 2,           // GPT Image 2 high
  '4k': 3,         // Nano Banana 2 4K

  // Video Generation (per second)
  video480: 14,    // ~$0.09/sec
  video720: 38,    // ~$0.25/sec

  // Other operations
  upscale: 2,      // Topaz Labs ~$0.08
  chat: 1,         // Per 1K tokens ~$0.01
};

// ── Per-model cost lookup ─────────────────────────────────────────────────────
// resolution param: aiConfig.resolution  e.g. '1024x1024', '2048x2048', '4096x4096'
// qualityVariant param: aiConfig.stylePreset or gpt quality field  e.g. 'low'|'medium'|'high'|'auto'
// prunaTarget param: aiConfig.prunaTarget (megapixels)

export interface ModelCostParams {
  resolution?: string;       // e.g. '1024x1024'
  qualityVariant?: string;   // GPT Image 2: 'low' | 'medium' | 'high' | 'auto'
  prunaTarget?: number;      // P Image Upscale target megapixels
}

// ── Per-model helpers (keep each helper ≤ 5 branches) ───────────────────────

function resolveResPixels(resolution: string): number {
  const [w, h] = resolution.split('x').map(Number);
  return (w && h) ? w * h : 0;
}

function costNanaBanana2(resolution: string, px: number): number {
  if (px >= 4096 * 4096 || resolution.includes('4K')) return 3;
  if (px >= 2048 * 2048 || resolution.includes('2K')) return 2;
  return 2;
}

function costNanaBananaPro(resolution: string, px: number): number {
  if (px >= 4096 * 4096 || resolution.includes('4K')) return 5;
  if (px >= 1024 * 1024 || resolution.includes('1K') || resolution.includes('2K')) return 3;
  return 1;
}

function costGptImage2(qualityVariant: string): number {
  if (qualityVariant === 'low')    return 1;
  if (qualityVariant === 'medium') return 1;
  return 2; // auto / high
}

function costPrunaUpscale(prunaTarget: number = 4): number {
  const mp = prunaTarget;
  if (mp <= 32) return 1;
  return 2;   // 32-128MP
}

// ── Flat cost table for simple models ────────────────────────────────────────
const FLAT_MODEL_COSTS: Record<string, number> = {
  'bytedance/seedream-4.5':                        1,
  'black-forest-labs/flux-2-pro':                  1,
  'black-forest-labs/flux-kontext-pro':            1,
  'xai/grok-imagine-image':                        1,
  'stability-ai/stable-diffusion-3.5-large':       1,  // $0.065 actual → 1 credit ($0.10) = 54% margin
  'topazlabs/image-upscale':                       2,
  'philz1337x/clarity-upscaler':                   1,
};

export function getModelCost(model: string, params: ModelCostParams = {}): number {
  const { resolution = '', qualityVariant = 'auto', prunaTarget } = params;
  const px = resolveResPixels(resolution);

  if (model === 'google/nano-banana-2')   return costNanaBanana2(resolution, px);
  if (model === 'google/nano-banana-pro') return costNanaBananaPro(resolution, px);
  if (model === 'openai/gpt-image-2')     return costGptImage2(qualityVariant);
  if (model === 'prunaai/p-image-upscale') return costPrunaUpscale(prunaTarget);
  return FLAT_MODEL_COSTS[model] ?? GENERATION_COST.standard;
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
      balance: 0,
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

/**
 * Add credits (after purchase)
 */
export async function addCredits(
  userId: string,
  credits: number,
  amountUsd: number,
  paymentId?: string
): Promise<boolean> {
  const { error: rpcError } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_credits: credits,
  });

  if (rpcError) {
    logger.error('[Credit] Failed to add credits:', rpcError);
    // Fallback: manual update
    return manualAddCredits(userId, credits, amountUsd, paymentId);
  }

  return true;
}

async function manualAddCredits(
  userId: string,
  credits: number,
  amountUsd: number,
  paymentId?: string
): Promise<boolean> {
  const credit = await getUserCredit(userId);
  if (!credit) return false;

  const newBalance = credit.balance + credits;
  const newTotalPurchased = credit.totalPurchased + credits;

  const { error } = await supabase
    .from('user_credits')
    .update({
      balance: newBalance,
      total_purchased: newTotalPurchased,
      last_purchase_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    logger.error('[Credit] Manual add failed:', error);
    return false;
  }

  // Record transaction
  await recordTransaction({
    userId,
    type: 'purchase',
    amount: credits,
    balanceAfter: newBalance,
    description: `Purchased ${credits} credits for $${amountUsd}`,
    metadata: { amount_usd: amountUsd, payment_id: paymentId },
  });

  return true;
}

/**
 * Deduct credits for generation
 */
export async function deductCredits(
  userId: string,
  cost: number,
  description: string
): Promise<{ success: boolean; remaining: number; error?: string }> {
  const credit = await getUserCredit(userId);
  if (!credit) {
    return { success: false, remaining: 0, error: 'Unable to verify credits' };
  }

  if (credit.balance < cost) {
    return {
      success: false,
      remaining: credit.balance,
      error: `Insufficient credits. Need ${cost}, have ${credit.balance}`,
    };
  }

  const newBalance = credit.balance - cost;
  const newTotalUsed = credit.totalUsed + cost;

  const { error } = await supabase
    .from('user_credits')
    .update({
      balance: newBalance,
      total_used: newTotalUsed,
    })
    .eq('user_id', userId);

  if (error) {
    logger.error('[Credit] Failed to deduct:', error);
    return { success: false, remaining: credit.balance, error: 'Deduction failed' };
  }

  // Record transaction
  await recordTransaction({
    userId,
    type: 'usage',
    amount: -cost,
    balanceAfter: newBalance,
    description,
  });

  return { success: true, remaining: newBalance };
}

/**
 * Check if user has enough credits
 */
export async function checkCreditBalance(
  userId: string,
  cost: number = GENERATION_COST.standard
): Promise<{ hasEnough: boolean; balance: number; needed: number }> {
  const credit = await getUserCredit(userId);
  if (!credit) {
    return { hasEnough: false, balance: 0, needed: cost };
  }

  return {
    hasEnough: credit.balance >= cost,
    balance: credit.balance,
    needed: cost,
  };
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
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

/**
 * Refund credits for a failed operation
 */
export async function refundCredits(
  userId: string,
  credits: number,
  description: string
): Promise<boolean> {
  const { error: rpcError } = await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_credits: credits,
  });

  if (rpcError) {
    logger.error('[Credit] Failed to refund credits via RPC:', rpcError);
    // Fallback: manual update
    const credit = await getUserCredit(userId);
    if (!credit) return false;

    const newBalance = credit.balance + credits;
    const { error } = await supabase
      .from('user_credits')
      .update({
        balance: newBalance,
      })
      .eq('user_id', userId);

    if (error) {
      logger.error('[Credit] Manual refund failed:', error);
      return false;
    }

    await recordTransaction({
      userId,
      type: 'refund',
      amount: credits,
      balanceAfter: newBalance,
      description,
    });
    return true;
  }

  // If RPC succeeded, get new balance to record transaction
  const credit = await getUserCredit(userId);
  const newBalance = credit ? credit.balance : 0;

  await recordTransaction({
    userId,
    type: 'refund',
    amount: credits,
    balanceAfter: newBalance,
    description,
  });

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function recordTransaction(
  tx: Omit<CreditTransaction, 'id' | 'createdAt'>
): Promise<void> {
  const { error } = await supabase.from('credit_transactions').insert({
    user_id: tx.userId,
    type: tx.type,
    amount: tx.amount,
    balance_after: tx.balanceAfter,
    description: tx.description,
    metadata: tx.metadata || {},
  });

  if (error) {
    logger.error('[Credit] Failed to record transaction:', error);
  }
}

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
