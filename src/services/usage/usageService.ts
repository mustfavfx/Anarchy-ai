/**
 * Usage Tracking Service
 * Tracks user generations and limits via Supabase
 */

import { supabase } from '../supabase/supabaseClient';
import { logger } from '../../utils/logger';
import type { PlanType } from '../plans/plansConfig';
// PlanLimits is used indirectly via getPlan return type
import { getPlan } from '../plans/plansConfig';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UserUsage {
  userId: string;
  plan: PlanType;
  generationsUsed: number;
  generationsLimit: number;
  storageUsedMb: number;
  storageLimitMb: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  resetAt: string;
}

export interface UsageCheck {
  allowed: boolean;
  reason?: string;
  remaining: number;
  limit: number;
  used: number;
}

export type QuotaErrorType = 'generations' | 'storage' | 'projects';

export interface QuotaError {
  type: QuotaErrorType;
  message: string;
  messageAr: string;
  current: number;
  limit: number;
  upgradePlan: PlanType;
}

// ── Table Operations ─────────────────────────────────────────────────────────

/**
 * Get or create user usage record
 */
export async function getUserUsage(userId: string): Promise<UserUsage | null> {
  const { data, error } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error?.code === 'PGRST116') {
    // No record found, create one
    return createUserUsage(userId);
  }

  if (error) {
    logger.error('[Usage] Failed to get user usage:', error);
    return null;
  }

  return data ? mapDbToUserUsage(data) : null;
}

/**
 * Create initial usage record for new user (Free plan)
 */
export async function createUserUsage(userId: string): Promise<UserUsage | null> {
  const plan = getPlan('free');
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data, error } = await supabase
    .from('user_usage')
    .insert({
      user_id: userId,
      plan: 'free',
      generations_used: 0,
      generations_limit: plan.limits.generationsPerMonth,
      storage_used_mb: 0,
      storage_limit_mb: plan.limits.storageGb * 1024,
      billing_cycle_start: now.toISOString(),
      billing_cycle_end: nextMonth.toISOString(),
      reset_at: nextMonth.toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error('[Usage] Failed to create user usage:', error);
    return null;
  }

  return data ? mapDbToUserUsage(data) : null;
}

/**
 * Increment generation count
 */
export async function incrementGeneration(
  userId: string,
  count: number = 1
): Promise<boolean> {
  const { error } = await supabase.rpc('increment_generation', {
    p_user_id: userId,
    p_count: count,
  });

  if (error) {
    logger.error('[Usage] Failed to increment generation:', error);
    return false;
  }

  return true;
}

/**
 * Check if user can generate (quota check)
 */
export async function checkGenerationQuota(userId: string): Promise<UsageCheck> {
  const usage = await getUserUsage(userId);

  if (!usage) {
    return {
      allowed: false,
      reason: 'Unable to verify quota. Please try again.',
      remaining: 0,
      limit: 0,
      used: 0,
    };
  }

  // Check if cycle needs reset
  const now = new Date();
  const resetAt = new Date(usage.resetAt);
  if (now >= resetAt) {
    await resetUsageCycle(userId, usage.plan);
    return checkGenerationQuota(userId); // Retry after reset
  }

  const plan = getPlan(usage.plan);
  const limit = plan.limits.generationsPerMonth;

  if (limit === -1) {
    return { allowed: true, remaining: -1, limit: -1, used: usage.generationsUsed };
  }

  const remaining = limit - usage.generationsUsed;
  if (remaining <= 0) {
    return {
      allowed: false,
      reason: getQuotaErrorMessage('generations', usage.plan),
      remaining: 0,
      limit,
      used: usage.generationsUsed,
    };
  }

  return {
    allowed: true,
    remaining,
    limit,
    used: usage.generationsUsed,
  };
}

/**
 * Update user plan (after subscription)
 */
export async function updateUserPlan(
  userId: string,
  newPlan: PlanType
): Promise<boolean> {
  const plan = getPlan(newPlan);

  const { error } = await supabase
    .from('user_usage')
    .update({
      plan: newPlan,
      generations_limit: plan.limits.generationsPerMonth,
      storage_limit_mb: plan.limits.storageGb * 1024,
    })
    .eq('user_id', userId);

  if (error) {
    logger.error('[Usage] Failed to update plan:', error);
    return false;
  }

  return true;
}

/**
 * Reset usage cycle (monthly reset)
 */
async function resetUsageCycle(userId: string, _plan: PlanType): Promise<boolean> {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const { error } = await supabase
    .from('user_usage')
    .update({
      generations_used: 0,
      storage_used_mb: 0,
      billing_cycle_start: now.toISOString(),
      billing_cycle_end: nextMonth.toISOString(),
      reset_at: nextMonth.toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    logger.error('[Usage] Failed to reset cycle:', error);
    return false;
  }

  return true;
}

// ── Error Messages ────────────────────────────────────────────────────────────

function getQuotaErrorMessage(type: 'generations' | 'storage' | 'projects', currentPlan: PlanType): string {
  const upgradePlan = currentPlan === 'free' ? 'pro' : 'business';
  const messages: Record<typeof type, { en: string; ar: string }> = {
    generations: {
      en: `You've reached your monthly generation limit. Upgrade to ${getPlan(upgradePlan).name} for more.`,
      ar: `لقد بلغت الحد الشهري للتوليدات. قم بالترقية إلى ${getPlan(upgradePlan).nameAr} للمزيد.`,
    },
    storage: {
      en: 'Storage limit reached. Delete old projects or upgrade your plan.',
      ar: 'تم بلوغ حد التخزين. احذف المشاريع القديمة أو قم بترقية خطتك.',
    },
    projects: {
      en: 'Project limit reached. Delete old projects or upgrade your plan.',
      ar: 'تم بلوغ حد المشاريع. احذف المشاريع القديمة أو قم بترقية خطتك.',
    },
  };

  return messages[type].en;
}

export function getQuotaError(type: 'generations' | 'storage' | 'projects', currentPlan: PlanType): QuotaError {
  const upgradePlan = currentPlan === 'free' ? 'pro' : 'business';
  const messages: Record<typeof type, { en: string; ar: string }> = {
    generations: {
      en: `You've reached your monthly generation limit.`,
      ar: 'لقد بلغت الحد الشهري للتوليدات.',
    },
    storage: {
      en: 'Storage limit reached.',
      ar: 'تم بلوغ حد التخزين.',
    },
    projects: {
      en: 'Project limit reached.',
      ar: 'تم بلوغ حد المشاريع.',
    },
  };

  return {
    type,
    message: messages[type].en,
    messageAr: messages[type].ar,
    current: 0,
    limit: 0,
    upgradePlan,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapDbToUserUsage(data: any): UserUsage {
  return {
    userId: data.user_id,
    plan: data.plan,
    generationsUsed: data.generations_used,
    generationsLimit: data.generations_limit,
    storageUsedMb: data.storage_used_mb,
    storageLimitMb: data.storage_limit_mb,
    billingCycleStart: data.billing_cycle_start,
    billingCycleEnd: data.billing_cycle_end,
    resetAt: data.reset_at,
  };
}

// ── Local Usage Cache (fallback when offline) ───────────────────────────────

const LOCAL_USAGE_KEY = 'anarchy_local_usage';

export function getLocalUsage(): Partial<UserUsage> | null {
  try {
    const data = localStorage.getItem(LOCAL_USAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setLocalUsage(usage: Partial<UserUsage>): void {
  try {
    localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore
  }
}
