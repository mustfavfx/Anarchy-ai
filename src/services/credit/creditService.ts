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
  width?: number;            // custom width
  height?: number;           // custom height
  videoDuration?: string | number; // video duration in seconds or string (e.g. '5s' or 5)
}

// ── Per-model helpers (keep each helper ≤ 5 branches) ───────────────────────

function resolveResPixels(resolution: string, width?: number, height?: number): number {
  if (resolution === 'custom' && width && height) {
    return width * height;
  }
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

function costSeedream5Pro(resolution: string, px: number, _isTrial: boolean): number {
  // 1K = 1.5 CREDIT, 2K = 2.2 CREDIT
  if (px >= 2048 * 2048 || resolution.toLowerCase().includes('2k')) return 2.2;
  return 1.5;
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

export function costTopazUpscale(upscaleFactor?: string | number, isTrial: boolean = true, px: number = 1048576): number {
  let factor = 2;
  if (typeof upscaleFactor === 'number') {
    factor = upscaleFactor;
  } else if (typeof upscaleFactor === 'string') {
    if (upscaleFactor === 'None' || upscaleFactor === '1x') factor = 1;
    else if (upscaleFactor === '2x') factor = 2;
    else if (upscaleFactor === '4x') factor = 4;
    else if (upscaleFactor === '6x') factor = 6;
    else {
      const parsed = parseFloat(upscaleFactor);
      if (!isNaN(parsed) && parsed > 0) factor = parsed;
    }
  }

  // Calculate estimated output Megapixels (MP)
  const outputPixels = px * (factor * factor);
  const outputMP = outputPixels / 1000000;

  // Replicate Official Pricing Table for Topaz Labs (topazlabs/image-upscale):
  // MP <= 24  => $0.05 (0.5 Credits)
  // MP <= 48  => $0.10 (1.0 Credit)
  // MP <= 60  => $0.15 (1.5 Credits)
  // MP <= 96  => $0.20 (2.0 Credits)
  // MP <= 132 => $0.24 (2.4 Credits)
  // MP <= 168 => $0.29 (2.9 Credits)
  // MP <= 336 => $0.53 (5.3 Credits)
  // MP <= 512 => $0.82 (8.2 Credits)
  let costUSD = 0.05;
  if (outputMP <= 24) costUSD = 0.05;
  else if (outputMP <= 48) costUSD = 0.10;
  else if (outputMP <= 60) costUSD = 0.15;
  else if (outputMP <= 96) costUSD = 0.20;
  else if (outputMP <= 132) costUSD = 0.24;
  else if (outputMP <= 168) costUSD = 0.29;
  else if (outputMP <= 336) costUSD = 0.53;
  else costUSD = 0.82;

  // 1 Credit = $0.10 USD
  const creditCost = costUSD * 10;
  return Math.round(creditCost * 10) / 10;
}

// ── Flat cost table for simple models ────────────────────────────────────────
const TRIAL_FLAT_MODEL_COSTS: Record<string, number> = {
  'bytedance/seedream-4.5':                        1,
  'bytedance/seedream-5-pro':                      1.5,
  'black-forest-labs/flux-2-pro':                  1,
  'black-forest-labs/flux-kontext-pro':            1,
  'xai/grok-imagine-image':                        1,
  'prunaai/p-image':                                0.8,
  'krea/krea-2-large':                             1.2,
  'stability-ai/stable-diffusion-3.5-large':       1,
  'reve/edit-fast':                                0.4,
  'reve/create':                                   3,
  'reve/extract-layout':                           1.6,
  'reve/create-layout':                            1.6,
  'reve/render-layout':                            1.6,
  'reve/reconcile-layouts':                        1.6,
  'topazlabs/image-upscale':                       2,
  'philz1337x/clarity-upscaler':                   1,
  'bytedance/seedance-2.0':                        20,
  'kwaivgi/kling-v3-omni-video':                   30,
  'xai/grok-imagine-video-1.5':                    30,
  'prunaai/p-video':                               20,
  'google/veo-3.1-fast':                           35,
  'pixverse/pixverse-v6':                           25,
  'openai/sora-2-pro':                             40,
};

const PAID_FLAT_MODEL_COSTS: Record<string, number> = {
  'black-forest-labs/flux-kontext-pro':            1.0,
  'xai/grok-imagine-image':                        1.0,
  'prunaai/p-image':                                0.7,
  'krea/krea-2-large':                             1.2,
  'stability-ai/stable-diffusion-3.5-large':       1.18, // $0.065 / 0.055
  'reve/edit-fast':                                0.4,
  'reve/create':                                   3,
  'reve/extract-layout':                           1.6,
  'reve/create-layout':                            1.6,
  'reve/render-layout':                            1.6,
  'reve/reconcile-layouts':                        1.6,
  'bytedance/seedance-2.0':                        2.5,
  'kwaivgi/kling-v3-omni-video':                   3.5,
  'xai/grok-imagine-video-1.5':                    3.5,
  'prunaai/p-video':                               2.5,
  'google/veo-3.1-fast':                           4.0,
  'pixverse/pixverse-v6':                           3.0,
  'openai/sora-2-pro':                             4.5,
};

export function getModelCost(model: string, params: ModelCostParams = {}): number {
  const { resolution = '', qualityVariant = 'auto', prunaTarget, upscaleFactor, isTrial = true, width, height, videoDuration } = params;
  const px = resolveResPixels(resolution, width, height);

  // Video duration-based pricing
  if (
    model === 'bytedance/seedance-2.0' ||
    model === 'kwaivgi/kling-v3-omni-video' ||
    model === 'xai/grok-imagine-video-1.5' ||
    model === 'prunaai/p-video' ||
    model === 'google/veo-3.1-fast' ||
    model === 'pixverse/pixverse-v6' ||
    model === 'openai/sora-2-pro'
  ) {
    let dur = 5; // default 5 seconds
    if (videoDuration != null) {
      const parsed = parseInt(String(videoDuration).replace('s', ''), 10);
      if (!isNaN(parsed)) {
        dur = parsed === -1 ? 5 : parsed; // Intelligent duration defaults credit estimation to 5s
      }
    }

    let costPerSecond = 3.5;
    if (model === 'kwaivgi/kling-v3-omni-video') {
      const mode = resolution || 'pro';
      if (mode === 'standard') costPerSecond = 3.0;
      else if (mode === 'pro') costPerSecond = 5.0;
      else if (mode === '4k') costPerSecond = 12.0;
    } else if (model === 'xai/grok-imagine-video-1.5') {
      costPerSecond = 1.2;
    } else if (model === 'google/veo-3.1-fast') {
      costPerSecond = 5.5;
    } else if (model === 'openai/sora-2-pro') {
      const res = resolution || 'standard';
      if (res === 'high') costPerSecond = 12.0;
      else costPerSecond = 6.0;
    } else if (model === 'pixverse/pixverse-v6') {
      const res = resolution || '1080p';
      if (res === '360p') costPerSecond = 1.0;
      else if (res === '540p') costPerSecond = 1.8;
      else if (res === '720p') costPerSecond = 3.5;
      else if (res === '1080p') costPerSecond = 8.0;
      else costPerSecond = 8.0;
    } else if (model === 'prunaai/p-video') {
      const res = resolution || '720p';
      if (res === '1080p') costPerSecond = 6.0;
      else costPerSecond = 2.5;
    } else if (model === 'bytedance/seedance-2.0') {
      const res = resolution || '720p';
      if (res === '480p') costPerSecond = 1.5;
      else if (res === '720p') costPerSecond = 3.5;
      else if (res === '1080p') costPerSecond = 8.0;
      else if (res === '4k') costPerSecond = 18.0;
    } else {
      // Fallback for other video models (default to flat cost divided by 5s for estimation)
      costPerSecond = isTrial
        ? (TRIAL_FLAT_MODEL_COSTS[model] ?? 30) / 5
        : (PAID_FLAT_MODEL_COSTS[model] ?? 3.5);
    }

    return dur * costPerSecond;
  }

  if (model === 'reve/create')            return 3;
  if (model === 'reve/extract-layout')    return 1.6;
  if (model === 'reve/create-layout')     return 1.6;
  if (model === 'reve/render-layout')     return 1.6;
  if (model === 'reve/reconcile-layouts') return 1.6;
  if (model === 'reve/edit-fast')         return 0.4;
  if (model === 'google/nano-banana-2-lite') return 0.8;
  if (model === 'google/nano-banana-2')   return costNanaBanana2(resolution, px, isTrial);
  if (model === 'google/nano-banana-pro') return costNanaBananaPro(resolution, px, isTrial);
  if (model === 'openai/gpt-image-2')     return costGptImage2(qualityVariant, isTrial);
  if (model === 'bytedance/seedream-4.5')   return costSeedream4_5(resolution, px, isTrial);
  if (model === 'bytedance/seedream-5-pro') return costSeedream5Pro(resolution, px, isTrial);
  if (model === 'black-forest-labs/flux-2-pro') return costFlux2Pro(resolution, px, isTrial);
  if (model === 'prunaai/p-image-upscale') return costPrunaUpscale(prunaTarget, isTrial);
  if (model === 'topazlabs/image-upscale') return costTopazUpscale(upscaleFactor, isTrial, px);
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
