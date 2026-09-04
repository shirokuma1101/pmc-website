import Link from "next/link";
import type { Article } from "@/types";
import { articleSummary } from "@/lib/articles/excerpt";

import { Avatar } from "../ui/Avatar";
import { StatusBadge } from "../ui/StatusBadge";
import { LikeButton } from "../ui/LikeButton";

export interface ArticleCardProps {
  article: Article;
  showStatus?: boolean;
  showEditLink?: boolean;
  href?: string;
  headingLevel?: 2 | 3;
}

function formatArticleDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

export function ArticleCard({
  article,
  showStatus = false,
  showEditLink = false,
  href,
  headingLevel = 3,
}: ArticleCardProps) {
  const articleHref = href ?? (article.status === "published" ? `/articles/${article.slug}` : `/article/${article.id}/edit`);
  const displayDate = article.eventAt ?? article.publishedAt ?? article.createdAt;
  const date = formatArticleDate(displayDate);
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="article-card">
      <Link className="article-card__image-link" href={articleHref} tabIndex={-1} aria-hidden="true">
        {article.thumbnailUrl ? (
          <img className="article-card__image" src={article.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span className="article-card__image-placeholder">
            <span>記</span>
          </span>
        )}
      </Link>
      <div className="article-card__body">
        <div className="article-card__eyebrow">
          {showStatus ? <StatusBadge status={article.status} /> : <span>ARTICLE</span>}
          {date && displayDate ? <time dateTime={displayDate}>{date}</time> : null}
        </div>
        <Heading className="article-card__title">
          <Link href={articleHref}>{article.title}</Link>
        </Heading>
        <p className="article-card__summary">{articleSummary(article) || "本文はまだありません。"}</p>
        {article.tags.length ? (
          <ul className="article-tags" aria-label="タグ">
            {article.tags.map((tag) => <li key={tag}><Link href={`/articles?tag=${encodeURIComponent(tag)}`}>#{tag}</Link></li>)}
          </ul>
        ) : null}
        <div className="article-card__footer">
          <Link className="article-card__author" href={`/members/${article.author.id}`}>
            <Avatar user={article.author} size="sm" />
            <span>{article.author.displayName}</span>
          </Link>
          <LikeButton
            endpoint={`/api/articles/${article.id}/like`}
            initialCount={article.likeCount}
            initialLiked={article.likedByMe}
            canLike={article.canLike && article.status === "published"}
          />
          {showEditLink ? (
            <Link className="text-link article-card__edit-link" href={`/article/${article.id}/edit`}>
              編集 <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
