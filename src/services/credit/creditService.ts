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
//   Nano Banana 2    1K → 1.1 | 2K → 1.2 | 4K → 2.2
//   Seedream 5 Pro   1K → 0.8 | 2K → 1.3
//   Nano Banana 2 Lite        → 0.7
//   Nano Banana Pro  1K/2K → 2.2 | 4K → 4.2 | fallback → 1
//   GPT Image 2      low → 0.5 | medium → 0.8 | auto/high → 1.8
//   FLUX 2 Pro                → 0.5
//   Pruna P-Image             → 0.5
//   Krea 2 Large              → 1
//   FLUX Kontext Pro          → 1
//   Grok Imagine              → 1
//   Topaz Upscale             → 3
//   Clarity Upscaler          → 1

// Old costs (Trial)
export const TRIAL_GENERATION_COST = {
  standard: 1,
  hd: 2,
  '4k': 3,
  video480: 14,
  video720: 38,
  upscale: 2,
  chat: 0, // Free AI agent consultation (0 credits)
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
  chat: 0,           // Free AI agent consultation (0 credits)
};

// Backwards compatibility default reference
export const GENERATION_COST = TRIAL_GENERATION_COST;

// ── Per-model cost lookup ─────────────────────────────────────────────────────
// resolution param: aiConfig.resolution  e.g. '1024x1024', '2048x2048', '4096x4096'
// qualityVariant param: aiConfig.stylePreset or gpt quality field  e.g. 'low'|'medium'|'high'|'auto'
// prunaTarget param: aiConfig.prunaTarget (megapixels)

export interface ModelCostParams {
  resolution?: string;       // e.g. '1024x1024'
  aspectRatio?: string;      // e.g. '16:9' or '3840x2160'
  qualityVariant?: string;   // GPT Image 2: 'low' | 'medium' | 'high' | 'auto'
  prunaTarget?: number;      // P Image Upscale target megapixels
  prunaMode?: 'target' | 'factor'; // P Image Upscale mode
  prunaFactor?: number;      // P Image Upscale scaling factor
  upscaleFactor?: number;    // upscale factor e.g. 2, 4, 6, 8, 12
  isTrial?: boolean;         // check if user is on trial mode
  width?: number;            // custom width
  height?: number;           // custom height
  videoDuration?: string | number; // video duration in seconds or string (e.g. '5s' or 5)
  outputMegapixels?: number; // explicit output megapixels (e.g. for Topaz or Pruna)
}

// ── Per-model helpers (keep each helper ≤ 5 branches) ───────────────────────

function resolveResPixels(resolution: string, width?: number, height?: number): number {
  if (width && height && width > 0 && height > 0) {
    return width * height;
  }
  if (resolution) {
    const [w, h] = resolution.split('x').map(Number);
    if (w && h) return w * h;
  }
  return 0;
}

function costNanaBanana2(resolution: string, px: number, _isTrial?: boolean): number {
  if (px >= 4096 * 4096 || resolution.toLowerCase().includes('4k')) return 2.2;
  if (px >= 2048 * 2048 || resolution.toLowerCase().includes('2k')) return 1.2;
  return 1.1;
}

function costNanaBananaPro(resolution: string, px: number, _isTrial?: boolean): number {
  if (px >= 4096 * 4096 || resolution.toLowerCase().includes('4k')) return 4.2;
  if (px >= 1024 * 1024 || resolution.toLowerCase().includes('1k') || resolution.toLowerCase().includes('2k')) return 2.2;
  return 1.0;
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

function costSeedream5Pro(resolution: string, px: number, _isTrial?: boolean): number {
  if (px >= 2048 * 2048 || resolution.toLowerCase().includes('2k') || px >= 4096 * 4096 || resolution.toLowerCase().includes('4k')) return 1.3;
  return 0.8;
}

function costFlux2Pro(_resolution?: string, _px?: number, _isTrial?: boolean): number {
  return 0.5;
}

export function costNanoBanana2_1(resolution: string, px: number, _isTrial?: boolean): number {
  const res = (resolution || '').toLowerCase();
  if (px >= 4096 * 4096 || res.includes('4k')) return 1.5;
  if (px >= 2048 * 2048 || res.includes('2k')) return 1.0;
  return 0.7; // 1K default ($0.0336 = 0.7 credit)
}

export function costFlux3Image(resolution: string, px: number, _isTrial?: boolean): number {
  const res = (resolution || '').toLowerCase();
  if (px >= 4096 * 4096 || res.includes('4k')) return 4.0;
  if (px >= 2048 * 2048 || res.includes('2k')) return 1.0;
  if (res.includes('1.5k') || (px >= 1536 * 1536 && px < 2048 * 2048)) return 0.7;
  if (res.includes('768') || (px > 0 && px <= 768 * 768)) return 0.5;
  return 0.5; // 1K default ($0.024 = 0.5 credit)
}

function costGptImage2(qualityVariant: string, _isTrial?: boolean): number {
  const variant = (qualityVariant || 'auto').toLowerCase();
  if (variant === 'low') return 0.5;
  if (variant === 'medium') return 0.8;
  if (variant === 'high') return 1.8;
  return 1.8; // auto / default
}

function costGptImage2_5(qualityOrRes: string, _isTrial?: boolean): number {
  const variant = (qualityOrRes || 'auto').toLowerCase().replace(/[-_]/g, '');
  // Quality tiers
  if (variant === 'low') return 0.5;
  if (variant === 'medium') return 0.8;
  if (variant === 'high') return 1.8;
  if (variant === 'xhigh') return 3;
  if (variant === 'max') return 6.5;

  // Resolution tiers
  if (variant === '1k') return 2.5;
  if (variant === '2k') return 3;
  if (variant === '4k') return 5;

  return 3; // 'auto' or default is 3 credits ($0.25)
}

/**
 * Pruna AI Upscaler Cost based on official Replicate Megapixel brackets:
 * - 1-4 MP:   $0.005 Replicate cost -> 0.2 credits (Paid) / 1 credit (Trial)
 * - 4-8 MP:   $0.010 Replicate cost -> 0.4 credits (Paid) / 1 credit (Trial)
 * - 8-16 MP:  $0.020 Replicate cost -> 0.6 credits (Paid) / 1 credit (Trial)
 * - 16-32 MP: $0.040 Replicate cost -> 0.8 credits (Paid) / 1 credit (Trial)
 * - 32-64 MP: $0.060 Replicate cost -> 1.25 credits (Paid) / 2 credits (Trial)
 * - 64-128 MP:$0.120 Replicate cost -> 2.5 credits (Paid) / 3 credits (Trial)
 */
export function costPrunaUpscale(
  prunaTarget: number = 4,
  isTrial: boolean = true,
  mode: 'target' | 'factor' = 'target',
  factor: number = 2,
  px: number = 1048576,
  outputMegapixels?: number
): number {
  let mp = outputMegapixels ?? prunaTarget;
  if (mode === 'factor' && outputMegapixels == null) {
    const basePixels = px > 0 ? px : 1048576;
    mp = (basePixels * (factor * factor)) / 1_000_000;
  }

  if (isTrial) {
    if (mp <= 32) return 1;
    if (mp <= 64) return 2;
    return 3;   // 64-128MP
  } else {
    // Paid rates based on official Replicate brackets:
    if (mp <= 4)   return 0.2;
    if (mp <= 8)   return 0.4;
    if (mp <= 16)  return 0.6;
    if (mp <= 32)  return 0.8;
    if (mp <= 64)  return 1.25;
    return 2.5; // 64-128MP
  }
}


/**
 * Fast AI Upscaler Cost (Real-ESRGAN: nightmareai/real-esrgan)
 * Replicate Official Pricing: ~$0.001 - $0.002 per execution (T4 GPU).
 * Flat 1 credit ($0.10) for standard upscale -> 98% profit margin.
 */
export function costFastUpscale(
  _upscaleFactor?: number | string,
  _isTrial: boolean = true
): number {
  return 1;
}

/**
 * Clarity Upscaler Cost based on Nvidia A100 GPU Execution Time ($0.00115/sec):
 * - 2x: ~30-60s (~$0.05 actual cost with optimized steps) -> 3 credits ($0.30 revenue, ~80% margin)
 * - 4x: ~100-150s (~$0.15 actual cost)                     -> 10 credits ($1.00 revenue, ~85% margin)
 * - 8x: ~250-400s (~$0.40 cost)                           -> 20 credits ($2.00 revenue, ~80% margin)
 * - 12x: ~500-700s (~$0.70 cost)                          -> 30 credits ($3.00 revenue, ~75% margin)
 */
export function costClarityUpscale(upscaleFactor: number = 2, _isTrial: boolean = true): number {
  if (upscaleFactor >= 12) return 30;
  if (upscaleFactor >= 8)  return 20;
  if (upscaleFactor >= 4)  return 10;
  return 3;
}

/**
 * Anarchy Upscale (Clarity Pro: philz1337x/clarity-pro-upscaler)
 * Replicate Official Pricing: $0.03 per million output image pixels (capped at 64 MP).
 * Minimum 2 credits ($0.20), guaranteed 50%+ profit margin.
 */
export function costAnarchyUpscale(
  scaleFactor: number = 2,
  _isTrial: boolean = true,
  px: number = 1048576,
  outputMegapixels?: number
): number {
  let mp = outputMegapixels;
  if (mp == null || isNaN(mp) || mp <= 0) {
    const factor = Number(scaleFactor) || 2;
    const basePixels = px > 0 ? px : 1048576; // default 1024x1024 (1 MP)
    mp = Math.min(64, (basePixels * (factor * factor)) / 1_000_000);
  } else {
    mp = Math.min(64, mp);
  }
  // Cost on Replicate is mp * $0.03. With 1 credit = $0.10:
  // For 50%+ margin: mp * 0.03 * 2 / 0.10 = mp * 0.6
  return Math.max(2, Math.ceil(mp * 0.6));
}

/**
 * Dynamic Topaz Labs Image Upscale Cost based on real Replicate execution costs & Megapixel brackets.
 * 
 * Replicate Execution Cost: ~$0.16 minimum base per run on A100 GPU (15-16s)
 * Target margin: ~70-100% markup (1 credit = $0.10 USD)
 * 
 * Pricing Tiers:
 * - <= 24 MP (up to 4K):   3 credits ($0.30) -> Net Profit: +$0.14 (87% margin)
 * - <= 48 MP (up to 6K):   5 credits ($0.50) -> Net Profit: +$0.25+
 * - <= 60 MP (up to 8K):   7 credits ($0.70)
 * - <= 96 MP:              10 credits ($1.00)
 * - <= 132 MP:             14 credits ($1.40)
 * - <= 168 MP:             18 credits ($1.80)
 * - <= 336 MP:             30 credits ($3.00)
 * - <= 512 MP:             45 credits ($4.50)
 * - > 512 MP:              Math.max(45, Math.ceil(mp / 10))
 */
export function costTopazUpscale(
  upscaleFactor?: string | number,
  _isTrial: boolean = true,
  px: number = 1048576,
  outputMegapixels?: number
): number {
  let mp = outputMegapixels;
  if (mp == null || isNaN(mp) || mp <= 0) {
    let factor = 4;
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

    const basePixels = px > 0 ? px : 1048576; // default 1024x1024 (1 MP)
    const totalOutputPixels = basePixels * (factor * factor);
    mp = totalOutputPixels / 1_000_000;
  }

  if (mp <= 24)  return 3;
  if (mp <= 48)  return 5;
  if (mp <= 60)  return 7;
  if (mp <= 96)  return 10;
  if (mp <= 132) return 14;
  if (mp <= 168) return 18;
  if (mp <= 336) return 30;
  if (mp <= 512) return 45;
  return Math.max(45, Math.ceil(mp / 10));
}

// ── Flat cost table for simple models ────────────────────────────────────────
const TRIAL_FLAT_MODEL_COSTS: Record<string, number> = {
  'bytedance/seedream-4.5':                        1,
  'bytedance/seedream-5-pro':                      0.8,
  'black-forest-labs/flux-3-image':                0.5,
  'black-forest-labs/flux-kontext-pro':            1,
  'xai/grok-imagine-image':                        1,
  'prunaai/p-image':                               0.5,
  'krea/krea-2-large':                             1,
  'stability-ai/stable-diffusion-3.5-large':       1,
  'google/nano-banana-2-lite':                     0.7,
  'google/nano-banana-2.1':                        0.7,
  'reve/edit-fast':                                0.4,
  'reve/create':                                   3,
  'reve/extract-layout':                           1.6,
  'reve/create-layout':                            1.6,
  'reve/render-layout':                            1.6,
  'reve/reconcile-layouts':                        1.6,
  'topazlabs/image-upscale':                       3,
  'midjourney/mj-turbo-upscale':                   3,
  'midjourney/mj-turbo-upscale-subtle':            6,
  'midjourney/mj-turbo-upscale-creative':          6,
  'midjourney/mj-fast-upscale':                    1,
  'midjourney/mj-fast-upscale-subtle':             2,
  'midjourney/mj-fast-upscale-creative':           2,
  'philz1337x/clarity-upscaler':                   3,
  'philz1337x/clarity-pro-upscaler':               3,
  'bytedance/seedance-2.0':                        20,
  'kwaivgi/kling-v3-omni-video':                   30,
  'xai/grok-imagine-video-1.5':                    30,
  'prunaai/p-video':                               20,
  'google/veo-3.1-fast':                           35,
  'pixverse/pixverse-v6':                          25,
  'openai/sora-2-pro':                             40,
  'openai/gpt-image-2.5-flare':                    3,
  'openai/gpt-image-2.5-sunburst':                 3,
};

const PAID_FLAT_MODEL_COSTS: Record<string, number> = {
  'black-forest-labs/flux-3-image':                0.5,
  'black-forest-labs/flux-kontext-pro':            1.0,
  'xai/grok-imagine-image':                        1.0,
  'prunaai/p-image':                               0.5,
  'krea/krea-2-large':                             1,
  'google/nano-banana-2-lite':                     0.7,
  'google/nano-banana-2.1':                        0.7,
  'stability-ai/stable-diffusion-3.5-large':       1.18, // $0.065 / 0.055
  'reve/edit-fast':                                0.4,
  'reve/create':                                   3,
  'reve/extract-layout':                           1.6,
  'reve/create-layout':                            1.6,
  'reve/render-layout':                            1.6,
  'reve/reconcile-layouts':                        1.6,
  'topazlabs/image-upscale':                       3,
  'midjourney/mj-turbo-upscale':                   3,
  'midjourney/mj-turbo-upscale-subtle':            6,
  'midjourney/mj-turbo-upscale-creative':          6,
  'midjourney/mj-fast-upscale':                    1,
  'midjourney/mj-fast-upscale-subtle':             2,
  'midjourney/mj-fast-upscale-creative':           2,
  'philz1337x/clarity-pro-upscaler':               3,
  'bytedance/seedance-2.0':                        2.5,
  'kwaivgi/kling-v3-omni-video':                   3.5,
  'xai/grok-imagine-video-1.5':                    3.5,
  'prunaai/p-video':                               2.5,
  'google/veo-3.1-fast':                           4.0,
  'pixverse/pixverse-v6':                           3.0,
  'openai/sora-2-pro':                             4.5,
  'openai/gpt-image-2.5-flare':                    3,
  'openai/gpt-image-2.5-sunburst':                 3,
};

export function getModelCost(model: string, params: ModelCostParams = {}): number {
  const { resolution = '', aspectRatio, qualityVariant = 'auto', prunaTarget, upscaleFactor, isTrial = true, width, height, videoDuration, outputMegapixels } = params;
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
  if (model === 'google/nano-banana-2-lite') return 0.7;
  if (model === 'google/nano-banana-2.1') return costNanoBanana2_1(resolution, px, isTrial);
  if (model === 'google/nano-banana-2')   return costNanaBanana2(resolution, px, isTrial);
  if (model === 'google/nano-banana-pro') return costNanaBananaPro(resolution, px, isTrial);
  if (model === 'openai/gpt-image-2') {
    const q = (qualityVariant && qualityVariant !== 'auto')
      ? qualityVariant
      : (resolution || qualityVariant || 'auto');
    return costGptImage2(q, isTrial);
  }
  if (model === 'openai/gpt-image-2.5-flare' || model === 'openai/gpt-image-2.5-sunburst') {
    const ar = aspectRatio || (params as any)?.aspectRatio;
    let fallbackRes = resolution;
    if ((!fallbackRes || fallbackRes.toLowerCase() === 'auto') && ar && typeof ar === 'string') {
      if (ar === '3840x2160' || ar === '2160x3840') fallbackRes = '4k';
      else if (ar === '2048x2048' || ar === '2048x1152' || ar === '1152x2048') fallbackRes = '2k';
      else if (ar === '1024x1024' || ar === '1536x1024' || ar === '1024x1536') fallbackRes = '1k';
    }
    const q = (qualityVariant && qualityVariant !== 'auto')
      ? qualityVariant
      : (fallbackRes || qualityVariant || 'auto');
    return costGptImage2_5(q, isTrial);
  }
  if (model === 'bytedance/seedream-4.5')   return costSeedream4_5(resolution, px, isTrial);
  if (model === 'bytedance/seedream-5-pro') return costSeedream5Pro(resolution, px, isTrial);
  if (model === 'black-forest-labs/flux-3-image' || model === 'black-forest-labs/flux-2-pro') return costFlux3Image(resolution, px, isTrial);
  if (model === 'prunaai/p-image')        return 0.5;
  if (model === 'krea/krea-2-large')      return 1;
  if (model === 'nightmareai/real-esrgan') {
    return costFastUpscale(upscaleFactor, isTrial);
  }
  if (model === 'prunaai/p-image-upscale') {
    return costPrunaUpscale(prunaTarget, isTrial, params.prunaMode, params.prunaFactor, px, outputMegapixels);
  }
  if (model === 'topazlabs/image-upscale') return costTopazUpscale(upscaleFactor, isTrial, px, outputMegapixels);
  if (model === 'philz1337x/clarity-upscaler') return costClarityUpscale(upscaleFactor, isTrial);
  if (model === 'philz1337x/clarity-pro-upscaler') {
    return costAnarchyUpscale(upscaleFactor, isTrial, px, outputMegapixels);
  }
  
  if (isTrial) {
    return TRIAL_FLAT_MODEL_COSTS[model] ?? TRIAL_GENERATION_COST.standard;
  } else {
    return PAID_FLAT_MODEL_COSTS[model] ?? PAID_GENERATION_COST.standard;
  }
}

export function resolveUpscaleFactor(model: string, config: any): number | undefined {
  if (model === 'nightmareai/real-esrgan') {
    return config?.upscaleFactor ?? 2;
  }
  if (model === 'topazlabs/image-upscale') {
    const factorStr = config?.topazUpscaleFactor ?? '4x';
    if (factorStr === 'None' || factorStr === '1x') return 1;
    if (factorStr === '2x') return 2;
    if (factorStr === '4x') return 4;
    if (factorStr === '6x') return 6;
    return 4;
  }
  if (model === 'philz1337x/clarity-upscaler') {
    return config?.clarityScale ?? 2;
  }
  if (model === 'philz1337x/clarity-pro-upscaler') {
    return config?.anarchyUpscaleScale ?? config?.upscaleFactor ?? 2;
  }
  return undefined;
}

/**
 * getUnifiedCost — Single source of truth for calculating cost across Canvas, Mask, and Execution engines.
 */
export function getUnifiedCost(config: any, isTrial: boolean = true, overrideModel?: string): number {
  if (!config) return isTrial ? TRIAL_GENERATION_COST.standard : PAID_GENERATION_COST.standard;
  const model = overrideModel || config.model || 'google/nano-banana-2';
  const upscaleFactor = resolveUpscaleFactor(model, config);
  const isGpt2 = model === 'openai/gpt-image-2';
  const isGpt25 = model === 'openai/gpt-image-2.5-flare' || model === 'openai/gpt-image-2.5-sunburst';
  const qualityVariant = config.qualityVariant ?? config.gptQuality ?? ((isGpt2 || isGpt25) ? config.resolution : undefined) ?? 'auto';
  return getModelCost(model, {
    resolution: config.resolution,
    aspectRatio: config.aspectRatio,
    qualityVariant,
    prunaTarget: config.prunaTarget,
    prunaMode: config.prunaMode,
    prunaFactor: config.prunaFactor ?? upscaleFactor,
    upscaleFactor,
    isTrial,
    width: config.width,
    height: config.height,
    videoDuration: config.videoDuration,
    outputMegapixels: config.outputMegapixels,
  });
}

// Credit value: $1 = 100 credits
// $5 package = 500 credits
// $10 package = 1000 credits

// ── Development Mode ───────────────────────────────────────────────────────────
// Set to true to bypass credit checks during development
// Set to false to enforce credit system for production
export const DEV_MODE = false;

// ── Trial Credit Constants ───────────────────────────────────────────────────
export const TRIAL_CREDITS_AMOUNT = 20;
export const TRIAL_DURATION_DAYS = 7;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

export function isGuestUserId(userId?: string): boolean {
  if (!userId) return true;
  return userId === 'default_user' || userId === 'guest-architect-id' || userId.startsWith('guest-');
}

/**
 * Local trial credits storage for guest users or when Supabase is not configured
 */
export function getLocalTrialCredit(userId: string = 'guest-architect-id'): UserCredit {
  const key = `anarchy_trial_credit_${userId}`;
  const now = Date.now();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: UserCredit = JSON.parse(raw);
      const expiresAtMs = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : 0;
      const grantedMs = parsed.lastPurchaseAt ? new Date(parsed.lastPurchaseAt).getTime() : 0;
      const isPast7Days = (grantedMs > 0 && now - grantedMs > TRIAL_DURATION_MS) || (expiresAtMs > 0 && now > expiresAtMs);

      // Check 7-day trial expiration: if unconsumed, trial credits disappear!
      if (parsed.totalPurchased === 0 && isPast7Days) {
        if (parsed.balance > 0) {
          logger.log(`[Credit] 20 Free trial credits expired for user ${userId} after 7 days. Balance disappearing.`);
          parsed.balance = 0;
          localStorage.setItem(key, JSON.stringify(parsed));
        }
      }
      return parsed;
    }
  } catch (err) {
    logger.warn('[Credit] Error reading local trial credit:', err);
  }

  // First time initialization: 20 free trial credits valid for 7 days
  const expiresAt = new Date(now + TRIAL_DURATION_MS).toISOString();
  const initialCredit: UserCredit = {
    userId,
    balance: TRIAL_CREDITS_AMOUNT,
    totalPurchased: 0,
    totalUsed: 0,
    lastPurchaseAt: new Date(now).toISOString(),
    expiresAt,
  };
  try {
    localStorage.setItem(key, JSON.stringify(initialCredit));
  } catch {}
  return initialCredit;
}

export function saveLocalTrialCredit(userId: string, credit: UserCredit): void {
  try {
    localStorage.setItem(`anarchy_trial_credit_${userId}`, JSON.stringify(credit));
  } catch {}
}

export function deductLocalTrialCredit(
  userId: string,
  cost: number
): { success: boolean; remaining: number; error?: string } {
  const credit = getLocalTrialCredit(userId);
  const now = Date.now();
  const expiresAtMs = credit.expiresAt ? new Date(credit.expiresAt).getTime() : 0;

  if (credit.totalPurchased === 0 && expiresAtMs > 0 && now > expiresAtMs) {
    credit.balance = 0;
    saveLocalTrialCredit(userId, credit);
    return {
      success: false,
      remaining: 0,
      error: 'The 20 free trial credits have expired after 7 days. Please recharge your balance to continue.',
    };
  }

  if (credit.balance < cost) {
    return {
      success: false,
      remaining: credit.balance,
      error: `Insufficient credit balance. Required: ${cost}, available: ${credit.balance}`,
    };
  }

  credit.balance = Math.max(0, Number((credit.balance - cost).toFixed(2)));
  credit.totalUsed = Number(((credit.totalUsed || 0) + cost).toFixed(2));
  saveLocalTrialCredit(userId, credit);
  return { success: true, remaining: credit.balance };
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Get user credit balance
 */
export async function getUserCredit(userId: string): Promise<UserCredit | null> {
  if (isGuestUserId(userId) || !isSupabaseConfigured) {
    return getLocalTrialCredit(userId || 'guest-architect-id');
  }

  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error?.code === 'PGRST116') {
    // No record, create with 20 free trial credits valid for 7 days
    return createUserCredit(userId);
  }

  if (error) {
    logger.error('[Credit] Failed to get credit:', error);
    return null;
  }

  if (!data) return null;

  const credit = mapDbToUserCredit(data);
  const now = Date.now();

  // If user has not purchased paid credits, check the 7-day expiration
  if (credit.totalPurchased === 0) {
    let expiresAtMs = credit.expiresAt ? new Date(credit.expiresAt).getTime() : 0;
    const createdMs = data.created_at ? new Date(data.created_at).getTime() : 0;

    // Backward compatibility: If existing user didn't have expires_at set, compute from created_at + 7 days
    if (!expiresAtMs && createdMs > 0) {
      expiresAtMs = createdMs + TRIAL_DURATION_MS;
      credit.expiresAt = new Date(expiresAtMs).toISOString();
      supabase.from('user_credits').update({ expires_at: credit.expiresAt }).eq('user_id', userId).then();
    }

    // Expiration check: if user joined > 7 days ago OR expires_at has passed, unconsumed trial credits disappear!
    const isPast7Days = (createdMs > 0 && now - createdMs > TRIAL_DURATION_MS) || (expiresAtMs > 0 && now > expiresAtMs);
    if (isPast7Days && credit.balance > 0) {
      logger.log(`[Credit] 20 Free trial credits expired for user ${userId} (> 7 days). Balance disappearing to 0.`);
      credit.balance = 0;
      supabase.from('user_credits').update({ balance: 0, expires_at: credit.expiresAt }).eq('user_id', userId).then();
    }
  }

  return credit;
}

/**
 * Create initial credit record (20 free trial credits valid for 7 days)
 */
async function createUserCredit(userId: string): Promise<UserCredit | null> {
  const expiresAt = new Date(Date.now() + TRIAL_DURATION_MS).toISOString();
  const { data, error } = await supabase
    .from('user_credits')
    .insert({
      user_id: userId,
      balance: TRIAL_CREDITS_AMOUNT,
      total_purchased: 0,
      total_used: 0,
      expires_at: expiresAt,
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
  if (isGuestUserId(userId) || !isSupabaseConfigured) {
    return deductLocalTrialCredit(userId || 'guest-architect-id', cost);
  }

  try {
    // 1. Try atomic RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: cost,
      p_description: description,
    });

    if (!rpcError && typeof rpcData === 'number') {
      return { success: true, remaining: rpcData };
    }

    // 2. Direct table fallback if RPC is not present
    const { data: current, error: getErr } = await supabase
      .from('user_credits')
      .select('balance, total_used, total_purchased, expires_at')
      .eq('user_id', userId)
      .single();

    if (!getErr && current) {
      if (current.total_purchased === 0 && current.expires_at && Date.now() > new Date(current.expires_at).getTime()) {
        await supabase.from('user_credits').update({ balance: 0 }).eq('user_id', userId);
        return {
          success: false,
          remaining: 0,
          error: 'The 20 free trial credits have expired after 7 days. Please recharge your balance to continue.',
        };
      }
      if (current.balance < cost) {
        return { success: false, remaining: current.balance, error: 'Insufficient credit balance' };
      }
      const newBal = Math.max(0, Number((current.balance - cost).toFixed(2)));
      const newUsed = Number(((current.total_used || 0) + cost).toFixed(2));
      const { error: updateErr } = await supabase
        .from('user_credits')
        .update({ balance: newBal, total_used: newUsed })
        .eq('user_id', userId);

      if (!updateErr) {
        return { success: true, remaining: newBal };
      }
    }

    return { success: false, remaining: 0, error: rpcError?.message || getErr?.message || 'Failed to deduct credits' };
  } catch (err: any) {
    logger.warn('[Credit] Deduct credits fallback caught error:', err);
    return { success: false, remaining: 0, error: err?.message || 'Failed to deduct credits' };
  }
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
  if (isGuestUserId(userId) || !isSupabaseConfigured) {
    const credit = getLocalTrialCredit(userId || 'guest-architect-id');
    credit.balance = Number((credit.balance + credits).toFixed(2));
    saveLocalTrialCredit(userId || 'guest-architect-id', credit);
    return true;
  }

  try {
    const { error: rpcError } = await supabase.rpc('refund_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_description: description,
    });

    if (!rpcError) return true;

    // Fallback direct table update
    const { data: current } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (current) {
      await supabase
        .from('user_credits')
        .update({ balance: current.balance + credits })
        .eq('user_id', userId);
    }
    return true;
  } catch {
    return true;
  }
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
