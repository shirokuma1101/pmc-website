import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendJoinApplicationEmail, sendJoinDecisionEmail, sendSupporterPaymentEmail } from "./resend";

const input = {
  displayName: "<script>alert(1)</script>\r\nBcc: other@example.com",
  email: "join@example.com",
  minecraftGamertag: "PostMinePlayer",
  discordUsername: "postmine_user",
  motivation: "建築 & 探索をしたいです。",
};

describe("sendJoinApplicationEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PostMineClan <no-reply@postmineclan.com>";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.APP_URL = "http://localhost:3001";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.APP_URL;
  });

  it("sends only to the fixed support mailbox with an idempotency key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
    await expect(sendJoinApplicationEmail(input, "7e06c851-552d-45e7-8d3e-a8f07636213c")).resolves.toBe("email-id");

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.to).toEqual(["support@postmineclan.com"]);
    expect(body.reply_to).toBe("join@example.com");
    expect(body.html).not.toContain("<script>");
    expect(body.subject).not.toContain("\n");
    expect(body.subject).not.toContain("\r");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe("join-application/7e06c851-552d-45e7-8d3e-a8f07636213c");
  });

  it("fails closed when credentials are missing", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendJoinApplicationEmail(input, "7e06c851-552d-45e7-8d3e-a8f07636213c")).rejects.toMatchObject({ status: 503 });
  });

  it("sends an accepted decision only to the applicant", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "decision-email-id" }), { status: 200 }));
    await sendJoinDecisionEmail(input, "accepted", "Discordへご案内します。", "7e06c851-552d-45e7-8d3e-a8f07636213c");
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.to).toEqual(["join@example.com"]);
    expect(body.reply_to).toBe("support@postmineclan.com");
    expect(body.subject).toContain("承認");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toContain("/accepted");
  });

  it("sends an idempotent one-time payment confirmation to the Stripe customer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "support-email-id" }), { status: 200 }));
    await expect(sendSupporterPaymentEmail({
      id: "evt_support_paid",
      type: "checkout.session.completed",
      object: {
        id: "cs_test",
        payment_status: "paid",
        amount_total: 300,
        currency: "jpy",
        customer_details: { email: "supporter@example.com", name: "支援者" },
        metadata: { frequency: "one_time", tier: "supporter" },
      },
    })).resolves.toBe("support-email-id");
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.to).toEqual(["supporter@example.com"]);
    expect(body.subject).toContain("ありがとうございます");
    expect(body.text).toContain("¥300");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe("stripe-support/evt_support_paid/checkout.session.completed");
  });

  it("uses the Stripe customer API for subscription cancellation mail", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: "subscriber@example.com" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "support-email-id" }), { status: 200 }));
    await sendSupporterPaymentEmail({
      id: "evt_subscription_deleted",
      type: "customer.subscription.deleted",
      object: { id: "sub_test", customer: "cus_test", metadata: { tier: "premium" }, status: "canceled" },
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/customers/cus_test");
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.to).toEqual(["subscriber@example.com"]);
    expect(body.subject).toContain("解約");
  });

  it("skips the initial invoice to avoid a duplicate checkout confirmation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(sendSupporterPaymentEmail({
      id: "evt_initial_invoice",
      type: "invoice.paid",
      object: { id: "in_test", customer_email: "subscriber@example.com", billing_reason: "subscription_create" },
    })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
