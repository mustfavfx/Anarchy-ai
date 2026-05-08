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
    nameAr: 'مجاني',
    description: 'Perfect for getting started',
    descriptionAr: 'مثالي للبدء',
    priceUsd: 0,
    priceAr: 'مجاناً',
    features: [
      '50 generations per month',
      'Standard quality images',
      '7-day history retention',
      '3 active projects',
      'Community support',
    ],
    featuresAr: [
      '50 توليد شهرياً',
      'جودة صور قياسية',
      'حفظ السجل 7 أيام',
      '3 مشاريع نشطة',
      'دعم المجتمع',
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
    nameAr: 'احترافي',
    description: 'For serious creators',
    descriptionAr: 'للمنشئين الجادين',
    priceUsd: 19,
    priceAr: '$19/شهر',
    badge: 'Most Popular',
    badgeAr: 'الأكثر شيوعاً',
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
      '500 توليد شهرياً',
      'جودة عالية + HD',
      'سجل غير محدود',
      'مشاريع غير محدودة',
      'دعم أولوي',
      'نماذج LoRA مخصصة',
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
    nameAr: 'أعمال',
    description: 'For teams and studios',
    descriptionAr: 'للفرق والاستوديوهات',
    priceUsd: 79,
    priceAr: '$79/شهر',
    badge: 'Best Value',
    badgeAr: 'أفضل قيمة',
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
      'توليدات غير محدودة',
      'جودة قصوى + 4K',
      'تعاون فريق (5 مقاعد)',
      'وصول API',
      'دعم مخصص',
      'تدريب نماذج مخصص',
      'خيارات White-label',
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
