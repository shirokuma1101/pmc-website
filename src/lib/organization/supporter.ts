import type { SupporterTier } from "@/types";

export const SUPPORTER_TIER_KEYS = ["supporter", "basic", "standard", "premium"] as const;

export const ONE_TIME_SUPPORT = { amount: 800, label: "Standard Support (One-Time Purchase)", tier: "standard" } as const;
export const MAX_ONE_TIME_SUPPORT_QUANTITY = 12;
export const MONTHLY_SUPPORTER_PLANS = {
  basic: { amount: 300, label: "Basic Supporter", description: "気軽に活動を応援" },
  standard: { amount: 800, label: "Standard Supporter", description: "継続的な活動を支援" },
  premium: { amount: 1_500, label: "Premium Supporter", description: "活動を力強く支援" },
} as const;
export type MonthlySupporterTier = keyof typeof MONTHLY_SUPPORTER_PLANS;

const SUPPORTER_TIER_PRIORITY: Record<SupporterTier, number> = {
  supporter: 1,
  basic: 2,
  standard: 3,
  premium: 4,
};

export const SUPPORTER_TIERS: ReadonlyArray<{
  key: SupporterTier;
  label: string;
  description: string;
}> = [
  { key: "supporter", label: "Supporter", description: "過去の月額加入者・手動設定" },
  { key: "basic", label: "Basic", description: "月額ベーシックプラン" },
  { key: "standard", label: "Standard", description: "月額スタンダードプラン" },
  { key: "premium", label: "Premium", description: "月額プレミアムプラン" },
];

export function supporterTierLabel(tier?: SupporterTier): string | undefined {
  return SUPPORTER_TIERS.find((item) => item.key === tier)?.label;
}

export function supporterTierPriority(tier?: SupporterTier): number {
  return tier ? SUPPORTER_TIER_PRIORITY[tier] : 0;
}
