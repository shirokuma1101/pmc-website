import Link from "next/link";
import { ArticleArchive } from "@/components/article/ArticleArchive";
import { ArticleGrid } from "@/components/article/ArticleGrid";
import { Pagination } from "@/components/ui";
import { getPublishedArticles, getPublishedArticleTags } from "@/lib/directus/articles";

const PAGE_SIZE = 12;
const ARCHIVE_PAGE_SIZE = 50;

type ArticleView = "grid" | "archive";

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function articleView(value: string | string[] | undefined): ArticleView {
  return (Array.isArray(value) ? value[0] : value) === "archive" ? "archive" : "grid";
}

function singleValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 30) || undefined;
}

function articlesHref(view: ArticleView, tag?: string, page?: number) {
  const query = new URLSearchParams();
  if (view === "archive") query.set("view", "archive");
  if (tag) query.set("tag", tag);
  if (page && page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `/articles?${suffix}` : "/articles";
}

export const metadata = {
  title: "記事",
  description: "PostMineClanメンバーが公開した活動記事の一覧です。",
};

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; view?: string | string[]; tag?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const view = articleView(params.view);
  const tag = singleValue(params.tag);
  const [result, availableTags] = await Promise.all([
    getPublishedArticles({ page, limit: view === "archive" ? ARCHIVE_PAGE_SIZE : PAGE_SIZE, tag }),
    getPublishedArticleTags(),
  ]);
  const totalPages = result.pagination.total
    ? Math.max(1, Math.ceil(result.pagination.total / result.pagination.limit))
    : page + (result.pagination.hasMore ? 1 : 0);
  const displayedTags = tag && !availableTags.includes(tag) ? [tag, ...availableTags] : availableTags;

  return (
    <main id="main-content" className="page-shell">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">Articles</p>
          <h1>ニュース</h1>
        </div>
        <div className="articles-heading__aside">
          <p>活動から得た発見や考えを、まとまった文章で共有します。</p>
          <nav className="article-view-toggle" aria-label="記事の表示方法">
            <Link href={articlesHref("grid", tag)} aria-current={view === "grid" ? "page" : undefined}>
              <span className="article-view-toggle__grid" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
              カード
            </Link>
            <Link href={articlesHref("archive", tag)} aria-current={view === "archive" ? "page" : undefined}>
              <span className="article-view-toggle__timeline" aria-hidden="true"><i /><i /><i /></span>
              時系列
            </Link>
          </nav>
        </div>
      </header>
      <section className="article-tag-filter" aria-labelledby="article-tag-filter-title">
        <div>
          <p className="eyebrow" id="article-tag-filter-title">Filter by tag</p>
          <p>{tag ? <><strong>#{tag}</strong> の記事を表示しています。</> : "タグを選んで記事を絞り込めます。"}</p>
        </div>
        <div className="article-tag-filter__list">
          <Link href={articlesHref(view)} aria-current={!tag ? "page" : undefined}>すべて</Link>
          {displayedTags.map((availableTag) => (
            <Link
              key={availableTag}
              href={articlesHref(view, availableTag)}
              aria-current={tag === availableTag ? "page" : undefined}
            >
              #{availableTag}
            </Link>
          ))}
        </div>
      </section>
      {view === "archive" ? <ArticleArchive articles={result.data} /> : <ArticleGrid articles={result.data} />}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        basePath={articlesHref(view, tag)}
      />
    </main>
  );
}
