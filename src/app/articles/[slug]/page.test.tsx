import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { articleImageUrl } = vi.hoisted(() => ({
  articleImageUrl: "https://images.example.com/article.png",
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/config", () => ({ getPublicAppUrl: () => "https://pmc.example.com" }));
vi.mock("@/lib/directus/articles", () => ({
  getArticleBySlug: vi.fn().mockResolvedValue({
    id: "article-id",
    title: "画像を含む記事",
    slug: "article-with-image",
    summary: "",
    tags: [],
    body: `本文の前\n\n![本文画像](${articleImageUrl})\n\n本文の後`,
    thumbnailUrl: articleImageUrl,
    status: "published",
    author: { id: "author-id", displayName: "投稿者" },
    createdAt: "2026-08-26T00:00:00.000Z",
    publishedAt: "2026-08-26T00:00:00.000Z",
    likeCount: 0,
    likedByMe: false,
    canLike: false,
  }),
}));

import ArticleDetailPage, { generateMetadata } from "./page";

describe("Article detail image rendering", () => {
  it("renders the first body image only once while retaining it for social metadata", async () => {
    const params = Promise.resolve({ slug: "article-with-image" });
    const page = await ArticleDetailPage({ params });
    const { container } = render(page);

    expect(screen.getByRole("img", { name: "本文画像" })).toHaveAttribute("src", articleImageUrl);
    expect(container.querySelectorAll(`img[src="${articleImageUrl}"]`)).toHaveLength(1);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "article-with-image" }),
    });
    expect(metadata.openGraph?.images).toEqual([{ url: articleImageUrl, alt: "画像を含む記事" }]);
    expect(metadata.twitter?.images).toEqual([articleImageUrl]);
  });
});
