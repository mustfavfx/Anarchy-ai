/**
 * Plans & Pricing Configuration
 * Free / Pro / Business tiers
 */

export type PlanType = 'free' | 'pro' | 'business';

export interface PlanConfig {
  id: PlanType;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  priceUsd: number;
  priceAr: string;
  features: string[];
  featuresAr: string[];
  limits: PlanLimits;
  badge?: string;
  badgeAr?: string;
  popular?: boolean;
}

export interface PlanLimits {
  generationsPerMonth: number;
  imagesPerGeneration: number;
  storageGb: number;
  maxProjects: number;
  historyRetentionDays: number;
  apiAccess: boolean;
  prioritySupport: boolean;
  customModels: boolean;
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    nameAr: 'Free',
    description: 'Perfect for getting started',
    descriptionAr: 'Perfect for getting started',
    priceUsd: 0,
    priceAr: 'Free',
    features: [
      '50 generations per month',
      'Standard quality images',
      '7-day history retention',
      '3 active projects',
      'Community support',
    ],
    featuresAr: [
      '50 generations per month',
      'Standard quality images',
      '7-day history retention',
      '3 active projects',
      'Community support',
    ],
    limits: {
      generationsPerMonth: 50,
      imagesPerGeneration: 4,
      storageGb: 1,
      maxProjects: 3,
      historyRetentionDays: 7,
      apiAccess: false,
      prioritySupport: false,
      customModels: false,
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    nameAr: 'Pro',
    description: 'For serious creators',
    descriptionAr: 'For serious creators',
    priceUsd: 19,
    priceAr: '$19/mo',
    badge: 'Most Popular',
    badgeAr: 'Most Popular',
    popular: true,
    features: [
      '500 generations per month',
      'High quality + HD images',
      'Unlimited history',
      'Unlimited projects',
      'Priority support',
      'Custom LoRA models',
    ],
    featuresAr: [
      '500 generations per month',
      'High quality + HD images',
      'Unlimited history',
      'Unlimited projects',
      'Priority support',
      'Custom LoRA models',
    ],
    limits: {
      generationsPerMonth: 500,
      imagesPerGeneration: 8,
      storageGb: 50,
      maxProjects: -1, // unlimited
      historyRetentionDays: -1, // unlimited
      apiAccess: true,
      prioritySupport: true,
      customModels: true,
    },
  },

  business: {
    id: 'business',
    name: 'Business',
    nameAr: 'Business',
    description: 'For teams and studios',
    descriptionAr: 'For teams and studios',
    priceUsd: 79,
    priceAr: '$79/mo',
    badge: 'Best Value',
    badgeAr: 'Best Value',
    features: [
      'Unlimited generations',
      'Max quality + 4K images',
      'Team collaboration (5 seats)',
      'API access',
      'Dedicated support',
      'Custom model training',
      'White-label options',
    ],
    featuresAr: [
      'Unlimited generations',
      'Max quality + 4K images',
      'Team collaboration (5 seats)',
      'API access',
      'Dedicated support',
      'Custom model training',
      'White-label options',
    ],
    limits: {
      generationsPerMonth: -1, // unlimited
      imagesPerGeneration: 16,
      storageGb: 500,
      maxProjects: -1,
      historyRetentionDays: -1,
      apiAccess: true,
      prioritySupport: true,
      customModels: true,
    },
  },
};

export function getPlan(planId: PlanType): PlanConfig {
  return PLANS[planId];
}

export function getAllPlans(): PlanConfig[] {
  return Object.values(PLANS);
}

export function isLimitReached(current: number, limit: number): boolean {
  if (limit === -1) return false; // unlimited
  return current >= limit;
}

export function getRemaining(current: number, limit: number): number {
  if (limit === -1) return -1; // unlimited indicator
  return Math.max(0, limit - current);
}

export function formatLimit(limit: number): string {
  if (limit === -1) return '∞';
  return limit.toLocaleString();
}
