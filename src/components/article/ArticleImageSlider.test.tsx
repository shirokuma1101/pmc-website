import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Article } from "@/types";

import { ArticleImageSlider } from "./ArticleImageSlider";

function article(overrides: Partial<Article>): Article {
  return {
    id: "article-id",
    title: "記事",
    slug: "article",
    summary: "",
    tags: [],
    body: "本文",
    status: "published",
    author: { id: "author-id", displayName: "投稿者" },
    createdAt: "2026-08-26T00:00:00.000Z",
    likeCount: 0,
    likedByMe: false,
    canLike: false,
    ...overrides,
  };
}

describe("ArticleImageSlider", () => {
  it("shows only articles with the Minecraft tag and a thumbnail", () => {
    render(<ArticleImageSlider articles={[
      article({ id: "minecraft", title: "Minecraft記事", slug: "minecraft", tags: ["Minecraft"], thumbnailUrl: "https://images.example.com/minecraft.png" }),
      article({ id: "other", title: "その他の記事", slug: "other", tags: ["イベント"], thumbnailUrl: "https://images.example.com/other.png" }),
      article({ id: "no-image", title: "画像なし", slug: "no-image", tags: ["Minecraft"] }),
    ]} />);

    expect(screen.getByRole("link", { name: /^Minecraft記事/ })).toHaveAttribute("href", "/articles/minecraft");
    expect(screen.queryByRole("link", { name: /^その他の記事/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^画像なし/ })).not.toBeInTheDocument();
  });

  it("renders nothing when no eligible article exists", () => {
    const { container } = render(<ArticleImageSlider articles={[
      article({ tags: ["イベント"], thumbnailUrl: "https://images.example.com/other.png" }),
    ]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
