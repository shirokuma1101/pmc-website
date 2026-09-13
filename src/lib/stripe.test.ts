import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCheckoutSession, hasManageableStripeSubscription, verifyStripeSignature } from "./stripe";

describe("Stripe helpers", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3001";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    vi.restoreAllMocks();
  });

  it("creates server-controlled one-time Checkout parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 }));
    await expect(createCheckoutSession({ frequency: "one_time", amount: 300, tier: "supporter", userId: "user-id", email: "member@example.com", quantity: 1 })).resolves.toBe("https://checkout.stripe.test/session");
    const init = fetchMock.mock.calls[0][1];
    const body = init?.body as URLSearchParams;
    expect(body.get("mode")).toBe("payment");
    expect(body.get("managed_payments[enabled]")).toBe("false");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("300");
    expect(body.get("line_items[0][quantity]")).toBe("1");
    expect(body.get("metadata[user_id]")).toBe("user-id");
    expect(body.get("customer_email")).toBe("member@example.com");
    expect(body.has("payment_method_types[0]")).toBe(false);
  });

  it("uses the one-time Supporter product name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 }));
    await createCheckoutSession({ frequency: "one_time", amount: 300, tier: "supporter", userId: "user-id", quantity: 1 });
    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("line_items[0][price_data][product_data][name]")).toBe("Supporter (One-Time Purchase)");
  });

  it("creates recurring Checkout parameters and subscription metadata", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 }));
    await createCheckoutSession({ frequency: "monthly", amount: 1_500, tier: "premium", userId: "user-id", email: "member@example.com", quantity: 1 });
    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("managed_payments[enabled]")).toBe("false");
    expect(body.get("line_items[0][price_data][recurring][interval]")).toBe("month");
    expect(body.get("subscription_data[metadata][tier]")).toBe("premium");
    expect(body.get("subscription_data[metadata][user_id]")).toBe("user-id");
    expect(body.get("customer_email")).toBe("member@example.com");
  });

  it("allows portal access for subscriptions that need payment management", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "past_due" }] }), { status: 200 }));
    await expect(hasManageableStripeSubscription("cus_current")).resolves.toBe(true);
  });

  it("hides portal access for canceled subscriptions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "canceled" }] }), { status: 200 }));
    await expect(hasManageableStripeSubscription("cus_current")).resolves.toBe(false);
  });

  it("hides portal access for customer IDs from another Stripe environment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "resource_missing", message: "No such customer" } }), { status: 404 }));
    await expect(hasManageableStripeSubscription("cus_old")).resolves.toBe(false);
  });

  it("accepts one of multiple valid v1 webhook signatures", () => {
    const payload = JSON.stringify({ id: "evt_test" });
    const timestamp = 1_800_000_000;
    const valid = createHmac("sha256", "whsec_example").update(`${timestamp}.${payload}`).digest("hex");
    expect(() => verifyStripeSignature(payload, `t=${timestamp},v1=deadbeef,v1=${valid}`, timestamp)).not.toThrow();
  });

  it("rejects stale webhook signatures", () => {
    expect(() => verifyStripeSignature("{}", "t=100,v1=deadbeef", 401)).toThrow("timestamp");
  });
});
