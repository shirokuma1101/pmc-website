import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArticleCard } from "@/components/article";
import { EmptyState, Pagination } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getPendingArticles } from "@/lib/directus/articles";

const PAGE_SIZE = 12;

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const metadata = { title: "記事レビュー" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const page = pageNumber((await searchParams).page);
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/reviews");
  if (!session.user.isAdmin) notFound();
  const result = await getPendingArticles(session.accessToken, { page, limit: PAGE_SIZE });
  const totalPages = result.pagination.total
    ? Math.max(1, Math.ceil(result.pagination.total / result.pagination.limit))
    : page + (result.pagination.hasMore ? 1 : 0);

  return (
    <main id="main-content" className="page-shell">
      <header className="page-heading page-heading--split">
        <div><p className="eyebrow">Admin review</p><h1>レビュー待ちの記事</h1></div>
        <p>内容を確認し、公開するか著者へ差し戻します。</p>
      </header>
      {result.data.length ? (
        <div className="review-grid">
          {result.data.map((article) => (
            <div className="review-grid__item" key={article.id}>
              <ArticleCard article={article} showStatus href={`/admin/reviews/${article.id}`} />
              <Link className="button button--secondary button--sm" href={`/admin/reviews/${article.id}`}>レビューする</Link>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="レビュー待ちの記事はありません" description="新しい依頼が届くとここに表示されます。" symbol="済" />
      )}
      <Pagination currentPage={page} totalPages={totalPages} basePath="/admin/reviews" />
    </main>
  );
}
