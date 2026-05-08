/**
 * Credit-Based Pay-as-you-go System
 * Users buy credit upfront, consume per generation
 */

import { supabase } from '../supabase/supabaseClient';

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
  // $1 = 100 credits (1 credit = $0.01)
  { id: 'p10', amount: 10, credits: 1000, bonus: 50 },       // $10 = 1050 credits
  { id: 'p20', amount: 20, credits: 2000, bonus: 150 },    // $20 = 2150 credits  
  { id: 'p50', amount: 50, credits: 5000, bonus: 500 },     // $50 = 5500 credits
  { id: 'p100', amount: 100, credits: 10000, bonus: 1500 }, // $100 = 11500 credits
  { id: 'p1000', amount: 1000, credits: 100000, bonus: 25000 }, // $1000 = 125000 credits
  { id: 'custom', amount: 0, credits: 0, bonus: 0 },        // Custom amount (min $5)
];

// ── Cost Per Operation (Based on Replicate Pricing) ────────────────────────────
// 1 Credit ≈ $0.01 USD

export const GENERATION_COST = {
  // Image Generation (based on model costs)
  standard: 3,     // flux-schnell ~$0.003 (cheapest)
  hd: 25,          // flux-dev ~$0.025
  '4k': 40,        // flux-1.1-pro ~$0.04
  premium: 90,     // ideogram-v3 ~$0.09
  
  // Video Generation (per second)
  video480: 90,    // wan-2.1-i2v-480p ~$0.09/sec
  video720: 250,   // wan-2.1-i2v-720p ~$0.25/sec
  
  // Other operations
  upscale: 5,      // real-esrgan ~$0.005
  chat: 1,         // Per 1K tokens ~$0.01
};

// Credit value: $1 = 100 credits
// $5 package = 500 credits
// $10 package = 1000 credits

// ── Development Mode ───────────────────────────────────────────────────────────
// Set to true to bypass credit checks during development
// Set to false to enforce credit system for production
export const DEV_MODE = import.meta.env.DEV === true;

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
    console.error('[Credit] Failed to get credit:', error);
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
    console.error('[Credit] Failed to create credit record:', error);
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
    console.error('[Credit] Failed to add credits:', rpcError);
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
    console.error('[Credit] Manual add failed:', error);
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
    console.error('[Credit] Failed to deduct:', error);
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
    console.error('[Credit] Failed to get transactions:', error);
    return [];
  }

  return (data || []).map(mapDbToTransaction);
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
    console.error('[Credit] Failed to record transaction:', error);
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
