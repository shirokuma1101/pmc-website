import type { ArticleStatus } from "@/types";

export interface StatusBadgeProps {
  status: ArticleStatus;
  showDot?: boolean;
}

const statusLabels: Record<ArticleStatus, string> = {
  draft: "下書き",
  pending: "レビュー待ち",
  published: "公開済み",
  rejected: "差し戻し",
};

export function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {showDot ? <span className="status-badge__dot" aria-hidden="true" /> : null}
      {statusLabels[status]}
    </span>
  );
}
