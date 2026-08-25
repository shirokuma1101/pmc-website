import assert from "node:assert/strict";

import {
  discordArticlePayload,
  newlyReferencedImageIds,
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

console.log("Discord article payload tests passed");
