import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCheckoutSession, hasManageableStripeSubscription, hasOpenStripeSubscription, scheduleSubscriptionCancellation, verifyStripeSignature } from "./stripe";

describe("Stripe helpers", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3001";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.STRIPE_PRICE_SUPPORTER_ONE_TIME = "price_onetime";
    process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_basic";
    process.env.STRIPE_PRICE_STANDARD_MONTHLY = "price_standard";
    process.env.STRIPE_PRICE_PREMIUM_MONTHLY = "price_premium";
    vi.restoreAllMocks();
  });

  function mockCheckoutFetch(amount: number, monthly: boolean, url = "https://checkout.stripe.test/session") {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input).includes("/v1/prices/")
        ? new Response(JSON.stringify({ active: true, currency: "jpy", unit_amount: amount, recurring: monthly ? { interval: "month" } : null, tax_behavior: "inclusive", livemode: false }))
        : new Response(JSON.stringify({ url }), { status: 200 }));
  }

  it("creates server-controlled one-time Checkout parameters", async () => {
    const fetchMock = mockCheckoutFetch(300, false);
    await expect(createCheckoutSession({ frequency: "one_time", amount: 300, tier: "supporter", userId: "user-id", email: "member@example.com", quantity: 1 })).resolves.toBe("https://checkout.stripe.test/session");
    const init = fetchMock.mock.calls[1][1];
    const body = init?.body as URLSearchParams;
    expect(body.get("mode")).toBe("payment");
    expect(body.get("managed_payments[enabled]")).toBe("false");
    expect(body.get("line_items[0][price]")).toBe("price_onetime");
    expect(body.has("line_items[0][price_data][unit_amount]")).toBe(false);
    expect(body.get("line_items[0][quantity]")).toBe("1");
    expect(body.get("metadata[user_id]")).toBe("user-id");
    expect(body.get("customer_email")).toBe("member@example.com");
    expect(body.has("payment_method_types[0]")).toBe(false);
  });

  it("rejects a configured Price with the wrong amount before creating Checkout", async () => {
    const fetchMock = mockCheckoutFetch(400, false);
    await expect(createCheckoutSession({ frequency: "one_time", amount: 300, tier: "supporter", userId: "user-id", quantity: 1 })).rejects.toThrow("does not match");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a Price that is not configured as tax-inclusive", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ active: true, currency: "jpy", unit_amount: 300, recurring: null, tax_behavior: "unspecified", livemode: false })));
    await expect(createCheckoutSession({ frequency: "one_time", amount: 300, tier: "supporter", userId: "user-id", quantity: 1 })).rejects.toThrow("does not match");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("creates recurring Checkout parameters and subscription metadata", async () => {
    const fetchMock = mockCheckoutFetch(1_500, true);
    await createCheckoutSession({ frequency: "monthly", amount: 1_500, tier: "premium", userId: "user-id", email: "member@example.com", quantity: 1 });
    const body = fetchMock.mock.calls[1][1]?.body as URLSearchParams;
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("managed_payments[enabled]")).toBe("false");
    expect(body.get("line_items[0][price]")).toBe("price_premium");
    expect(body.has("line_items[0][price_data][recurring][interval]")).toBe(false);
    expect(body.get("subscription_data[metadata][tier]")).toBe("premium");
    expect(body.get("subscription_data[metadata][user_id]")).toBe("user-id");
    expect(body.get("customer_email")).toBe("member@example.com");
  });

  it("creates a deterministic replacement checkout without changing the old subscription first", async () => {
    const fetchMock = mockCheckoutFetch(800, true, "https://checkout.stripe.test/switch");
    await createCheckoutSession({ frequency: "monthly", amount: 800, tier: "standard", userId: "user-id", customer: "cus_old", switchFromSubscription: "sub_old", quantity: 1 });
    const init = fetchMock.mock.calls[1][1];
    const body = init?.body as URLSearchParams;
    expect(body.get("customer")).toBe("cus_old");
    expect(body.has("customer_email")).toBe(false);
    expect(body.get("metadata[switch_from_subscription]")).toBe("sub_old");
    expect(body.get("subscription_data[metadata][switch_from_subscription]")).toBe("sub_old");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("support-switch/sub_old");
  });

  it("schedules cancellation only for the verified old subscription and user", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "sub_old", customer: "cus_old", status: "active", metadata: { user_id: "user-id" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cancel_at_period_end: true })));
    await scheduleSubscriptionCancellation("sub_old", "cus_old", "user-id");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect((fetchMock.mock.calls[1][1]?.body as URLSearchParams).get("cancel_at_period_end")).toBe("true");
  });

  it("does not cancel a subscription owned by another user", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "sub_old", customer: "cus_old", status: "active", metadata: { user_id: "other-user" } })));
    await expect(scheduleSubscriptionCancellation("sub_old", "cus_old", "user-id")).rejects.toThrow("mismatch");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("allows portal access for subscriptions that need payment management", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "past_due" }] }), { status: 200 }));
    await expect(hasManageableStripeSubscription("cus_current")).resolves.toBe(true);
  });

  it("hides portal access for canceled subscriptions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "canceled" }] }), { status: 200 }));
    await expect(hasManageableStripeSubscription("cus_current")).resolves.toBe(false);
  });

  it("blocks incomplete subscriptions when starting a new monthly checkout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ data: [{ status: "incomplete" }] })));
    expect(await hasOpenStripeSubscription("cus_test")).toBe(true);
    expect(await hasManageableStripeSubscription("cus_test")).toBe(false);
  });

  it("checks subsequent subscription pages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "sub_old", status: "canceled" }], has_more: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "sub_active", status: "active" }], has_more: false })));
    expect(await hasOpenStripeSubscription("cus_test")).toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toContain("starting_after=sub_old");
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
