import { describe, expect, it } from "vitest";

import { articleExcerpt, articleSummary } from "./excerpt";

describe("articleExcerpt", () => {
  it("creates plain text from the beginning of Markdown", () => {
    expect(articleExcerpt("# 見出し\n\n本文の **大切な** [リンク](https://example.com)です。"))
      .toBe("見出し 本文の 大切な リンクです。");
  });

  it("truncates long text with an ellipsis", () => {
    expect(articleExcerpt("1234567890", 6)).toBe("12345…");
  });
});

describe("articleSummary", () => {
  it("prefers the configured summary", () => {
    expect(articleSummary({ summary: "指定した概要", body: "本文の内容" })).toBe("指定した概要");
  });

  it("falls back to a body excerpt when the summary is blank", () => {
    expect(articleSummary({ summary: "  ", body: "# 見出し\n\n本文の内容" })).toBe("見出し 本文の内容");
  });
});
