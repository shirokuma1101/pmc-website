import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown";
import { Avatar, LikeButton, ShareButton } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { articleSummary } from "@/lib/articles/excerpt";
import { getArticleBySlug } from "@/lib/directus/articles";
import { getPublicAppUrl } from "@/lib/config";

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "記事が見つかりません" };
  const description = articleSummary(article, 160);
  const articleUrl = `${getPublicAppUrl()}/articles/${encodeURIComponent(article.slug)}`;
  const socialImage = article.thumbnailUrl ?? "/pmc-logo.png";
  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      url: articleUrl,
      siteName: "PostMineClan",
      locale: "ja_JP",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author.displayName],
      tags: article.tags,
      images: [{ url: socialImage, alt: article.thumbnailUrl ? article.title : "PostMineClan" }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [socialImage],
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  const article = await getArticleBySlug(slug, session?.accessToken);
  if (!article) notFound();
  const canEdit = session?.user.isAdmin === true || session?.user.id === article.author.id;
  const articleUrl = `${getPublicAppUrl()}/articles/${encodeURIComponent(article.slug)}`;
  const summary = articleSummary(article, 220);
  const shareText = articleSummary(article, 100) || "PostMineClanの記事を共有します。";

  return (
    <main id="main-content">
      <article className="article-detail">
        <header className="article-detail__header">
          <Link className="back-link" href="/articles"><span aria-hidden="true">←</span> 記事一覧</Link>
          <p className="eyebrow">Article</p>
          <h1>{article.title}</h1>
          {summary ? <p className="article-detail__summary">{summary}</p> : null}
          {article.tags.length ? (
            <ul className="article-tags article-detail__tags" aria-label="タグ">
              {article.tags.map((tag) => <li key={tag}><Link href={`/articles?tag=${encodeURIComponent(tag)}`}>#{tag}</Link></li>)}
            </ul>
          ) : null}
          <div className="article-detail__byline">
            <Link href={`/members/${article.author.id}`}>
              <Avatar user={article.author} size="md" />
              <span><strong>{article.author.displayName}</strong><small>著者</small></span>
            </Link>
            <span className="article-detail__date">
              <small>投稿日時</small>
              <time dateTime={article.publishedAt ?? article.createdAt}>
                {formatDate(article.publishedAt ?? article.createdAt)}
              </time>
            </span>
            {article.eventAt ? (
              <span className="article-detail__date">
                <small>イベント日時</small>
                <time dateTime={article.eventAt}>{formatDate(article.eventAt)}</time>
              </span>
            ) : null}
            {article.updatedAt ? (
              <span className="article-detail__date">
                <small>更新日時</small>
                <time dateTime={article.updatedAt}>{formatDate(article.updatedAt)}</time>
              </span>
            ) : null}
            {canEdit ? (
              <Link className="button button--secondary button--sm article-detail__edit-link" href={`/article/${article.id}/edit`}>
                この記事を編集
              </Link>
            ) : null}
            <LikeButton
              endpoint={`/api/articles/${article.id}/like`}
              initialCount={article.likeCount}
              initialLiked={article.likedByMe}
              canLike={article.canLike}
            />
            <ShareButton title={article.title} text={shareText} url={articleUrl} />
          </div>
        </header>
        <div className="prose article-detail__body">
          <MarkdownContent>{article.body}</MarkdownContent>
        </div>
      </article>
    </main>
  );
}
