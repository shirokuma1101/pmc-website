import assert from "node:assert/strict";

import {
  discordArticlePayload,
  newlyReferencedImageIds,
  publicArticleView,
  shouldNotifyDiscordForArticleApproval,
  storedImageIdsInMarkdown,
} from "../src/index.js";

const bodyImageId = "123e4567-e89b-42d3-a456-426614174000";
assert.deepEqual(
  storedImageIdsInMarkdown(`![画像](https://cms.example.com/pmc-website/assets/${bodyImageId})`),
  [bodyImageId],
);
assert.deepEqual(storedImageIdsInMarkdown("![外部画像](https://example.com/image.webp)"), []);

const addedImageId = "123e4567-e89b-42d3-a456-426614174001";
assert.deepEqual(
  newlyReferencedImageIds(
    `![既存](https://cms.example.com/pmc-website/assets/${bodyImageId})`,
    `![既存](https://cms.example.com/pmc-website/assets/${bodyImageId})\n![追加](https://cms.example.com/pmc-website/assets/${addedImageId})`,
  ),
  [addedImageId],
);

const payload = discordArticlePayload(
  {
    id: "article-id",
    title: "公開記事 @everyone",
    slug: "published-article",
    body: "# 見出し\n\n本文の **先頭** です。",
    tags: ["Minecraft", "活動記録"],
    thumbnail: "thumbnail-id",
    published_at: "2026-08-23T09:00:00.000Z",
    display_name: "PMC Member",
  },
  "https://pmc.example.com/",
  "https://cms.example.com/",
);

assert.deepEqual(payload.allowed_mentions, { parse: [] });
assert.equal(payload.embeds.length, 1);
assert.equal(payload.embeds[0].url, "https://pmc.example.com/articles/published-article");
assert.equal(payload.embeds[0].description, "見出し 本文の 先頭 です。");
assert.equal(payload.embeds[0].author.name, "PMC Member");
assert.equal(payload.embeds[0].fields[0].value, "#Minecraft  #活動記録");
assert.equal(payload.embeds[0].image.url, "https://cms.example.com/pmc-website/assets/thumbnail-id");

const withoutThumbnail = discordArticlePayload(
  { title: "記事", slug: "article", body: "本文", thumbnail: "thumbnail-id" },
  "https://pmc.example.com",
  "http://cms.example.com",
);
assert.equal(withoutThumbnail.embeds[0].image, undefined);

assert.equal(shouldNotifyDiscordForArticleApproval({ published_version_title: null }), true);
assert.equal(shouldNotifyDiscordForArticleApproval({ published_version_title: "公開中の記事" }), false);
assert.equal(shouldNotifyDiscordForArticleApproval({ published_version_title: "公開中の記事" }, "true"), true);
assert.equal(shouldNotifyDiscordForArticleApproval({ published_version_title: "公開中の記事" }, "false"), false);

const revision = {
  id: "article-id",
  title: "承認待ちのタイトル",
  slug: "pending-slug",
  summary: "承認待ちの概要",
  tags: ["Draft"],
  body: "承認待ちの本文",
  thumbnail: { id: "pending-thumbnail" },
  status: "pending",
  published_version_title: "公開中のタイトル",
  published_version_slug: "published-slug",
  published_version_summary: "公開中の概要",
  published_version_tags: ["Published"],
  published_version_body: "公開中の本文",
  published_version_thumbnail: { id: "published-thumbnail" },
};
assert.deepEqual(publicArticleView(revision), {
  ...revision,
  title: "公開中のタイトル",
  slug: "published-slug",
  summary: "公開中の概要",
  tags: ["Published"],
  body: "公開中の本文",
  thumbnail: { id: "published-thumbnail" },
  status: "published",
});
assert.equal(publicArticleView({ id: "draft", status: "draft" }).status, "draft");

console.log("Discord article payload tests passed");
