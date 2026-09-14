import type { SupporterTier } from "@/types";

export const SUPPORTER_TIER_KEYS = ["supporter", "basic", "standard", "premium"] as const;

export const ONE_TIME_SUPPORT = { amount: 300, label: "Supporter (One-Time Purchase)", description: "Supporterバッジのみ", tier: "supporter" } as const;
export const MONTHLY_SUPPORTER_PLANS = {
  basic: { amount: 400, label: "Basic Supporter", benefits: ["Basic Supporterバッジ（非表示設定可）", "メンバー一覧でサポーターとして表示", "地図の時系列比較を利用可能"] },
  standard: { amount: 800, label: "Standard Supporter", benefits: ["Standard Supporterバッジ（非表示設定可）", "メンバー一覧でサポーターとして表示", "地図の時系列比較を利用可能"] },
  premium: { amount: 1_500, label: "Premium Supporter", benefits: ["Premium Supporterバッジ（非表示設定可）", "メンバー一覧でサポーターとして表示", "地図の時系列比較を利用可能"] },
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
