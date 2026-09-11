import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPublicAppUrl } from "@/lib/config";
import { MONTHLY_SUPPORTER_PLANS, ONE_TIME_SUPPORT } from "@/lib/organization/supporter";
import type { SupporterTier } from "@/types";

type MonthlyTier = keyof typeof MONTHLY_SUPPORTER_PLANS;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_INTERNAL_SECRET);
}

export async function createCheckoutSession(input: {
  frequency: "one_time" | "monthly";
  amount: number;
  tier: SupporterTier;
  userId?: string;
  quantity?: number;
}): Promise<string> {
  const body = new URLSearchParams({
    mode: input.frequency === "monthly" ? "subscription" : "payment",
    success_url: `${getPublicAppUrl()}/supporters/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getPublicAppUrl()}/supporters/cancel`,
    "line_items[0][quantity]": String(input.quantity ?? 1),
    "line_items[0][price_data][currency]": "jpy",
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]": input.frequency === "monthly"
      ? MONTHLY_SUPPORTER_PLANS[input.tier as MonthlyTier].label
      : ONE_TIME_SUPPORT.label,
    "metadata[frequency]": input.frequency,
    "metadata[tier]": input.tier,
    "metadata[quantity]": String(input.quantity ?? 1),
    ...(input.userId ? { "metadata[user_id]": input.userId, client_reference_id: input.userId } : {}),
  });
  if (input.frequency === "monthly") {
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("subscription_data[metadata][tier]", input.tier);
    body.set("subscription_data[metadata][user_id]", input.userId!);
  }
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const payload = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) throw new Error(payload.error?.message ?? "Stripe Checkout session creation failed");
  return payload.url;
}

export async function createCustomerPortalSession(customer: string): Promise<string> {
  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ customer, return_url: `${getPublicAppUrl()}/supporters` }),
    cache: "no-store",
  });
  const payload = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) throw new Error(payload.error?.message ?? "Stripe portal session creation failed");
  return payload.url;
}

export function verifyStripeSignature(payload: string, signature: string, now = Math.floor(Date.now() / 1_000)): void {
  const entries = signature.split(",").map((part) => part.split("=", 2));
  const timestamp = Number(entries.find(([key]) => key === "t")?.[1]);
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300 || signatures.length === 0) {
    throw new Error("Invalid Stripe signature timestamp");
  }
  const expected = createHmac("sha256", requiredEnvironment("STRIPE_WEBHOOK_SECRET"))
    .update(`${timestamp}.${payload}`)
    .digest();
  const valid = signatures.some((value) => {
    try {
      const actual = Buffer.from(value, "hex");
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch { return false; }
  });
  if (!valid) throw new Error("Invalid Stripe signature");
}
