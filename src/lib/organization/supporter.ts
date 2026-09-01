import type { SupporterTier } from "@/types";

export const SUPPORTER_TIER_KEYS = ["supporter", "basic", "standard", "premium"] as const;

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
  { key: "supporter", label: "Supporter", description: "一回支援・過去の月額加入者" },
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
