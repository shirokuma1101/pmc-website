import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import extension from "../src/index.js";

// Run only inside a disposable Directus-image container sharing a test Postgres container's network.
if (process.env.DB_DATABASE !== "supporter_test" || process.env.DB_HOST !== "127.0.0.1") {
  throw new Error("This test requires the isolated supporter_test database on localhost.");
}
const packages = await readdir("/directus/node_modules/.pnpm");
const knexPackage = packages.find((name) => name.startsWith("knex@"));
const require = createRequire(import.meta.url);
const knex = require(`/directus/node_modules/.pnpm/${knexPackage}/node_modules/knex`);
const database = knex({ client: "pg", connection: { host: "127.0.0.1", user: "postgres", password: "supporter-test-only", database: "supporter_test" } });
process.env.STRIPE_INTERNAL_SECRET = "supporter-storage-test-only";

try {
  // Fail rather than deleting or reusing any existing database contents.
  assert.equal(await database.schema.hasTable("directus_users"), false);
  await database.schema.createTable("directus_users", (table) => table.uuid("id").primary());
  await database.schema.createTable("profiles", (table) => table.uuid("id").primary());
  await database.schema.createTable("organization_members", (table) => {
    table.uuid("id").primary(); table.uuid("user").unique(); table.uuid("organization_group");
    table.string("xbox_gamertag"); table.uuid("minecraft_skin"); table.string("minecraft_skin_model");
  });
  const sql = await readFile(new URL("../../../schema/supporter-storage.sql", import.meta.url), "utf8");
  const dryRun = await database.transaction();
  await dryRun.raw(sql);
  await dryRun.rollback();
  assert.equal(await database.schema.hasTable("supporter_payments"), false);
  await database.raw(sql);
  await database.raw(sql);

  const handlers = new Map();
  const router = Object.fromEntries(["get", "post", "put", "patch", "delete"].map((method) => [method, (path, handler) => handlers.set(`${method} ${path}`, handler)]));
  extension.handler(router, { database, services: {}, getSchema: async () => ({}), logger: console });
  async function post(path, body, secret = process.env.STRIPE_INTERNAL_SECRET) {
    const response = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; }, send() {} };
    await handlers.get(`post ${path}`)({ body, get: () => secret }, response, (error) => { throw error; });
    return response;
  }
  const user = "123e4567-e89b-42d3-a456-426614174099";
  const member = "123e4567-e89b-42d3-a456-426614174098";
  await database("directus_users").insert({ id: user });
  await database("organization_members").insert({ id: member, user });
  const event = { id: "evt_storage_test", created: 1_800_000_000, type: "checkout.session.completed", livemode: false, notificationKey: "stripe-support/cs_storage/checkout-paid", object: { id: "cs_storage", payment_status: "paid", customer: "cus_storage", metadata: { frequency: "one_time", tier: "supporter", quantity: "1", user_id: user } } };
  assert.equal((await post("/support-events", event, "wrong")).statusCode, 401);
  // Initialize once, then exercise parallel delivery across the same member.
  assert.equal((await post("/support-events", event)).body.data.notificationSent, false);
  const responses = await Promise.all(Array.from({ length: 6 }, () => post("/support-events", event)));
  assert.ok(responses.every((response) => response.statusCode === 200));
  assert.equal(Number((await database("supporter_payments").count("* as count").first()).count), 1);
  assert.equal(Number((await database("profile_entitlements").count("* as count").first()).count), 1);
  assert.equal((await post("/support-email-sent", { id: event.id, notificationKey: event.notificationKey, emailId: "resend_test" })).statusCode, 204);
  assert.equal((await post("/support-events", event)).body.data.notificationSent, true);
  assert.equal((await post("/support-events", { ...event, id: "evt_second_delivery", type: "checkout.session.async_payment_succeeded" })).body.data.notificationSent, true);
  const legacy = { ...event, id: "evt_legacy", notificationKey: null };
  await post("/support-events", legacy);
  assert.equal((await post("/support-events", { ...legacy, notificationKey: "legacy-key" })).statusCode, 409);
  const subscriptionEvent = (id, subscription, created, status, tier) => ({ id, created, livemode: false, type: status === "canceled" ? "customer.subscription.deleted" : "customer.subscription.updated", object: { id: subscription, status, metadata: { tier, user_id: user } } });
  await post("/support-events", subscriptionEvent("evt_new_active", "sub_new", 200, "active", "basic"));
  await post("/support-events", subscriptionEvent("evt_old_canceled", "sub_old", 300, "canceled", "premium"));
  await post("/support-events", subscriptionEvent("evt_old_active_late", "sub_old", 100, "active", "premium"));
  assert.equal((await database("profile_entitlements").where({ source: "stripe_subscription" }).first()).variant, "basic");
  await post("/support-events", subscriptionEvent("evt_new_canceled", "sub_new", 400, "canceled", "basic"));
  await post("/support-events", subscriptionEvent("evt_new_active_late", "sub_new", 200, "active", "basic"));
  assert.equal((await database("profile_entitlements").where({ source: "stripe_subscription" }).first()).status, "revoked");
  const ambiguous = { ...event, id: "evt_ambiguous", notificationKey: "ambiguous-key" };
  await post("/support-events", ambiguous);
  await database("supporter_payments").where({ stripe_event_id: ambiguous.id }).update({ created_at: new Date(Date.now() - 25 * 60 * 60 * 1000) });
  assert.equal((await post("/support-events", ambiguous)).statusCode, 409);
  console.log("Supporter storage: migration dry-run/rerun, authorization, parallel replay, notification ledger and legacy replay passed.");
} finally {
  await database.destroy();
}
