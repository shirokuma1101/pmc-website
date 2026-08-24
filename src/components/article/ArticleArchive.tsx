import Link from "next/link";
import type { Article } from "@/types";

import { EmptyState } from "../ui/EmptyState";

interface DatedArticle {
  article: Article;
  date: Date;
  year: number;
  month: number;
}

interface ArchiveMonth {
  month: number;
  articles: DatedArticle[];
}

interface ArchiveYear {
  year: number;
  count: number;
  months: ArchiveMonth[];
}

const datePartsFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  timeZone: "Asia/Tokyo",
});

const displayDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

function articleDate(article: Article) {
  const value = article.publishedAt ?? article.updatedAt ?? article.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yearAndMonth(date: Date) {
  const parts = datePartsFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month };
}

export function buildArticleArchive(articles: Article[]): ArchiveYear[] {
  const datedArticles = articles
    .map((article) => {
      const date = articleDate(article);
      if (!date) return null;
      return { article, date, ...yearAndMonth(date) };
    })
    .filter((item): item is DatedArticle => item !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const years = new Map<number, Map<number, DatedArticle[]>>();
  for (const item of datedArticles) {
    const months = years.get(item.year) ?? new Map<number, DatedArticle[]>();
    const monthArticles = months.get(item.month) ?? [];
    monthArticles.push(item);
    months.set(item.month, monthArticles);
    years.set(item.year, months);
  }

  return Array.from(years, ([year, months]) => ({
    year,
    count: Array.from(months.values()).reduce((total, items) => total + items.length, 0),
    months: Array.from(months, ([month, monthArticles]) => ({ month, articles: monthArticles })),
  }));
}

export function ArticleArchive({ articles }: { articles: Article[] }) {
  const archive = buildArticleArchive(articles);

  if (archive.length === 0) {
    return <EmptyState title="記事はまだありません" description="公開された記事が時系列でここに並びます。" symbol="時" />;
  }

  return (
    <div className="article-archive">
      {archive.map((yearGroup) => (
        <section className="article-archive__year" key={yearGroup.year} aria-labelledby={`archive-year-${yearGroup.year}`}>
          <header className="article-archive__year-heading">
            <h2 id={`archive-year-${yearGroup.year}`}>{yearGroup.year}</h2>
            <span>{yearGroup.count}件</span>
          </header>

          <div className="article-archive__months">
            {yearGroup.months.map((monthGroup) => (
              <section className="article-archive__month" key={`${yearGroup.year}-${monthGroup.month}`}>
                <header className="article-archive__month-heading">
                  <h3>{monthGroup.month}月</h3>
                  <span>{monthGroup.articles.length}件</span>
                </header>

                <ol className="article-archive__items">
                  {monthGroup.articles.map(({ article, date }) => (
                    <li className="article-archive__item" key={article.id}>
                      <span className="article-archive__marker" aria-hidden="true" />
                      <div className="article-archive__entry">
                        <h4>
                          <Link href={`/articles/${article.slug}`}>{article.title}</Link>
                        </h4>
                        <p>
                          <time dateTime={article.publishedAt ?? article.updatedAt ?? article.createdAt}>
                            {displayDateFormatter.format(date)}
                          </time>
                          <span aria-hidden="true">・</span>
                          <Link href={`/members/${article.author.id}`}>{article.author.displayName}</Link>
                        </p>
                        {article.tags.length ? (
                          <ul className="article-tags" aria-label="タグ">
                            {article.tags.map((tag) => (
                              <li key={tag}><Link href={`/articles?view=archive&tag=${encodeURIComponent(tag)}`}>#{tag}</Link></li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
