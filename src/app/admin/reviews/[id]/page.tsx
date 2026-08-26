import { notFound, redirect } from "next/navigation";
import { ReviewForm } from "@/components/admin";
import { MarkdownContent } from "@/components/markdown";
import { Avatar, StatusBadge } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getArticleById, getArticleReviews } from "@/lib/directus/articles";
import { articleSummary } from "@/lib/articles/excerpt";

export const metadata = { title: "記事レビュー" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/admin/reviews/${id}`)}`);
  if (!session.user.isAdmin) notFound();
  const [article, reviews] = await Promise.all([
    getArticleById(id, session.accessToken),
    getArticleReviews(id, session.accessToken).catch(() => []),
  ]);
  if (!article || article.status !== "pending") notFound();

  return (
    <main id="main-content" className="page-shell page-shell--review">
      <header className="review-header">
        <div><p className="eyebrow">Review preview</p><h1>{article.title}</h1></div>
        <StatusBadge status={article.status} />
        <p>{articleSummary(article, 220) || "本文はまだありません。"}</p>
        <div className="review-header__author">
          <Avatar user={article.author} size="md" />
          <span><strong>{article.author.displayName}</strong><small>最終更新 {formatDate(article.updatedAt ?? article.createdAt)}</small></span>
        </div>
      </header>

      {article.thumbnailUrl ? <img className="review-thumbnail" src={article.thumbnailUrl} alt="" /> : null}
      <div className="review-layout">
        <article className="prose review-preview">
          <MarkdownContent>{article.body}</MarkdownContent>
        </article>
        <aside className="review-sidebar">
          <ReviewForm articleId={article.id} articleTitle={article.title} />
          {reviews.length ? (
            <section className="review-history" aria-labelledby="review-history-title">
              <h2 id="review-history-title">履歴</h2>
              <ol>{reviews.map((review) => (
                <li key={review.id}>
                  <strong>{review.action === "submitted" ? "レビュー依頼" : review.action === "approved" ? "承認" : "差し戻し"}</strong>
                  <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
                  {review.comment ? <p>{review.comment}</p> : null}
                </li>
              ))}</ol>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
