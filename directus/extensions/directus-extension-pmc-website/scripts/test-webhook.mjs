import assert from "node:assert/strict";

import {
  discordArticlePayload,
  encodedDownloadFilename,
  newlyReferencedImageIds,
  publicArticleView,
  shouldNotifyDiscordForArticleApproval,
  stripeSupportEvent,
  storedImageIdsInMarkdown,
} from "../src/index.js";

assert.equal(encodedDownloadFilename("PMC 1.0's world.zip"), "PMC%201.0%27s%20world.zip");

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
  event_at: "2026-09-05T09:00:00.000Z",
  published_version_event_at: "2026-08-01T09:00:00.000Z",
};
assert.deepEqual(publicArticleView(revision), {
  ...revision,
  title: "公開中のタイトル",
  slug: "published-slug",
  summary: "公開中の概要",
  tags: ["Published"],
  body: "公開中の本文",
  thumbnail: { id: "published-thumbnail" },
  event_at: "2026-08-01T09:00:00.000Z",
  status: "published",
});
assert.equal(publicArticleView({ id: "draft", status: "draft" }).status, "draft");

const supporterUserId = "123e4567-e89b-42d3-a456-426614174099";
const paidOneTime = stripeSupportEvent({
  type: "checkout.session.completed",
  object: {
    id: "cs_test_paid",
    payment_status: "paid",
    metadata: { frequency: "one_time", tier: "standard", quantity: "3", user_id: supporterUserId },
  },
});
assert.equal(paidOneTime.active, true);
assert.equal(paidOneTime.quantity, 3);
assert.equal(paidOneTime.entitlementSource, "stripe_one_time");

const unpaidOneTime = stripeSupportEvent({
  type: "checkout.session.completed",
  object: {
    id: "cs_test_unpaid",
    status: "complete",
    payment_status: "unpaid",
    metadata: { frequency: "one_time", tier: "standard", quantity: "1", user_id: supporterUserId },
  },
});
assert.equal(unpaidOneTime.active, false);

const activeSubscription = stripeSupportEvent({
  type: "customer.subscription.updated",
  object: { id: "sub_test", status: "active", metadata: { tier: "premium", user_id: supporterUserId } },
});
assert.equal(activeSubscription.active, true);
assert.equal(activeSubscription.frequency, "monthly");
assert.equal(activeSubscription.entitlementSource, "stripe_subscription");

const canceledSubscription = stripeSupportEvent({
  type: "customer.subscription.deleted",
  object: { id: "sub_test", status: "canceled", metadata: { tier: "premium", user_id: supporterUserId } },
});
assert.equal(canceledSubscription.active, false);
assert.equal(canceledSubscription.status, "revoked");

const paidRenewal = stripeSupportEvent({
  type: "invoice.paid",
  object: {
    id: "in_test_paid",
    status: "paid",
    amount_paid: 1500,
    parent: { subscription_details: { subscription: "sub_test", metadata: { tier: "premium", user_id: supporterUserId } } },
  },
});
assert.equal(paidRenewal.active, true);
assert.equal(paidRenewal.userId, supporterUserId);
assert.equal(paidRenewal.externalReference, "sub_test");

const failedRenewal = stripeSupportEvent({
  type: "invoice.payment_failed",
  object: {
    id: "in_test_failed",
    status: "open",
    amount_due: 1500,
    parent: { subscription_details: { subscription: "sub_test", metadata: { tier: "premium", user_id: supporterUserId } } },
  },
});
assert.equal(failedRenewal.active, false);
assert.equal(failedRenewal.status, "revoked");

console.log("Discord article payload tests passed");
