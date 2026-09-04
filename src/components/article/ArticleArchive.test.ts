import { describe, expect, it } from "vitest";

import type { Article } from "@/types";

import { buildArticleArchive } from "./ArticleArchive";

function article(id: string, publishedAt: string): Article {
  return {
    id,
    title: `Article ${id}`,
    slug: `article-${id}`,
    summary: "",
    tags: [],
    body: "",
    status: "published",
    author: { id: "author", displayName: "Author" },
    createdAt: publishedAt,
    publishedAt,
    likeCount: 0,
    likedByMe: false,
    canLike: false,
  };
}

describe("buildArticleArchive", () => {
  it("groups and sorts articles by their publication month in Japan time", () => {
    const archive = buildArticleArchive([
      article("august", "2026-08-01T00:00:00.000Z"),
      article("previous-year", "2025-12-01T00:00:00.000Z"),
      article("jst-september", "2026-08-31T15:30:00.000Z"),
      article("latest", "2026-09-20T00:00:00.000Z"),
    ]);

    expect(archive.map(({ year, count }) => ({ year, count }))).toEqual([
      { year: 2026, count: 3 },
      { year: 2025, count: 1 },
    ]);
    expect(archive[0].months.map(({ month }) => month)).toEqual([9, 8]);
    expect(archive[0].months[0].articles.map(({ article: item }) => item.id)).toEqual([
      "latest",
      "jst-september",
    ]);
  });

  it("omits articles without a valid date", () => {
    expect(buildArticleArchive([article("invalid", "not-a-date")])).toEqual([]);
  });

  it("uses the event date before the publication date and falls back when absent", () => {
    const eventArticle = { ...article("event", "2026-01-01T00:00:00.000Z"), eventAt: "2026-09-01T00:00:00.000Z" };
    const publishedArticle = article("published", "2026-08-01T00:00:00.000Z");

    const archive = buildArticleArchive([publishedArticle, eventArticle]);

    expect(archive[0].months[0].articles.map(({ article: item }) => item.id)).toEqual(["event"]);
    expect(archive[0].months[1].articles.map(({ article: item }) => item.id)).toEqual(["published"]);
  });
});
