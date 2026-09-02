import type { OrganizationGroupColor } from "@/types";

export const DEFAULT_ORGANIZATION_GROUP_COLOR: OrganizationGroupColor = "violet";

export const ORGANIZATION_GROUP_PALETTE: ReadonlyArray<{
  key: OrganizationGroupColor;
  label: string;
}> = [
  { key: "violet", label: "バイオレット" },
  { key: "rose", label: "ローズ" },
  { key: "green", label: "グリーン" },
  { key: "cyan", label: "シアン" },
  { key: "indigo", label: "インディゴ" },
  { key: "orange", label: "オレンジ" },
  { key: "plum", label: "プラム" },
  { key: "red", label: "レッド" },
  { key: "olive", label: "オリーブ" },
  { key: "sky", label: "スカイ" },
  { key: "brown", label: "ブラウン" },
  { key: "magenta", label: "マゼンタ" },
];

export const ORGANIZATION_GROUP_COLOR_KEYS = ["blue", "teal", "gold", "violet", "rose", "slate", "green", "cyan", "indigo", "orange", "plum", "red", "olive", "sky", "brown", "magenta"] as const;
