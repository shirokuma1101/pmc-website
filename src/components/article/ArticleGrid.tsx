import type { Article } from "@/types";

import { EmptyState } from "../ui/EmptyState";
import { ArticleCard } from "./ArticleCard";

export interface ArticleGridProps {
  articles: Article[];
  showStatus?: boolean;
  showEditLinks?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ArticleGrid({
  articles,
  showStatus = false,
  showEditLinks = false,
  emptyTitle = "記事はまだありません",
  emptyDescription = "公開された記事がここに並びます。",
}: ArticleGridProps) {
  if (articles.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} symbol="文" />;
  }

  return (
    <div className="article-grid">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} showStatus={showStatus} showEditLink={showEditLinks} />
      ))}
    </div>
  );
}
