import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  symbol?: string;
}

export function EmptyState({
  title,
  description,
  action,
  symbol = "○",
}: EmptyStateProps) {
  return (
    <section className="empty-state" aria-label={title}>
      <span className="empty-state__symbol" aria-hidden="true">
        {symbol}
      </span>
      <h2 className="empty-state__title">
        {title}
      </h2>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}
