import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPublicAppUrl } from "@/lib/config";
import { MONTHLY_SUPPORTER_PLANS } from "@/lib/organization/supporter";
import type { SupporterTier } from "@/types";

type MonthlyTier = keyof typeof MONTHLY_SUPPORTER_PLANS;

export class StripeApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_INTERNAL_SECRET
    && process.env.STRIPE_PRICE_SUPPORTER_ONE_TIME && process.env.STRIPE_PRICE_BASIC_MONTHLY
    && process.env.STRIPE_PRICE_STANDARD_MONTHLY && process.env.STRIPE_PRICE_PREMIUM_MONTHLY);
}

function configuredPriceId(frequency: "one_time" | "monthly", tier: SupporterTier): string {
  const name = frequency === "one_time" ? "STRIPE_PRICE_SUPPORTER_ONE_TIME" : {
    basic: "STRIPE_PRICE_BASIC_MONTHLY",
    standard: "STRIPE_PRICE_STANDARD_MONTHLY",
    premium: "STRIPE_PRICE_PREMIUM_MONTHLY",
  }[tier as MonthlyTier];
  if (!name) throw new StripeApiError("Invalid supporter plan");
  const id = requiredEnvironment(name);
  if (!/^price_[A-Za-z0-9]+$/.test(id)) throw new StripeApiError(`${name} is not a Stripe Price ID`);
  return id;
}

async function verifyCheckoutPrice(id: string, frequency: "one_time" | "monthly", amount: number): Promise<void> {
  const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const price = await response.json() as { active?: boolean; currency?: string; unit_amount?: number; recurring?: { interval?: string } | null; tax_behavior?: string; livemode?: boolean; error?: { message?: string; code?: string } };
  if (!response.ok) throw new StripeApiError(price.error?.message ?? "Stripe Price lookup failed", price.error?.code);
  const monthly = frequency === "monthly";
  if (!price.active || price.currency !== "jpy" || price.unit_amount !== amount || price.tax_behavior !== "inclusive"
    || (monthly ? price.recurring?.interval !== "month" : price.recurring != null)
    || price.livemode !== requiredEnvironment("STRIPE_SECRET_KEY").startsWith("sk_live_")) {
    throw new StripeApiError("Configured Stripe Price does not match the supporter plan");
  }
}

export async function createCheckoutSession(input: {
  frequency: "one_time" | "monthly";
  amount: number;
  tier: SupporterTier;
  userId?: string;
  email?: string;
  quantity?: number;
  requestId?: string;
  customer?: string;
  switchFromSubscription?: string;
}): Promise<string> {
  const priceId = configuredPriceId(input.frequency, input.tier);
  await verifyCheckoutPrice(priceId, input.frequency, input.amount);
  const body = new URLSearchParams({
    mode: input.frequency === "monthly" ? "subscription" : "payment",
    "managed_payments[enabled]": "false",
    success_url: `${getPublicAppUrl()}/supporters/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getPublicAppUrl()}/supporters/cancel`,
    "line_items[0][quantity]": String(input.quantity ?? 1),
    "line_items[0][price]": priceId,
    "metadata[frequency]": input.frequency,
    "metadata[tier]": input.tier,
    "metadata[quantity]": String(input.quantity ?? 1),
    ...(input.userId ? { "metadata[user_id]": input.userId, client_reference_id: input.userId } : {}),
    ...(input.customer ? { customer: input.customer } : input.email ? { customer_email: input.email } : {}),
  });
  if (input.frequency === "monthly") {
    body.set("subscription_data[metadata][tier]", input.tier);
    body.set("subscription_data[metadata][user_id]", input.userId!);
    if (input.switchFromSubscription) {
      body.set("metadata[switch_from_subscription]", input.switchFromSubscription);
      body.set("subscription_data[metadata][switch_from_subscription]", input.switchFromSubscription);
    }
  }
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(input.switchFromSubscription
        ? { "Idempotency-Key": `support-switch/${input.switchFromSubscription}` }
        : input.requestId ? { "Idempotency-Key": `support-checkout/${input.userId}/${input.requestId}` } : {}),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as { url?: string; error?: { code?: string; message?: string } };
  if (!response.ok || !payload.url) throw new StripeApiError(payload.error?.message ?? "Stripe Checkout session creation failed", payload.error?.code);
  return payload.url;
}

export async function createCustomerPortalSession(customer: string): Promise<string> {
  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ customer, return_url: `${getPublicAppUrl()}/supporters` }),
    cache: "no-store",
  });
  const payload = await response.json() as { url?: string; error?: { code?: string; message?: string } };
  if (!response.ok || !payload.url) {
    throw new StripeApiError(payload.error?.message ?? "Stripe portal session creation failed", payload.error?.code);
  }
  return payload.url;
}

const MANAGEABLE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);

export async function hasManageableStripeSubscription(customer: string): Promise<boolean> {
  return hasSubscriptionWithStatus(customer, MANAGEABLE_SUBSCRIPTION_STATUSES);
}

export async function hasOpenStripeSubscription(customer: string): Promise<boolean> {
  return hasSubscriptionWithStatus(customer, new Set([...MANAGEABLE_SUBSCRIPTION_STATUSES, "incomplete"]));
}

export interface StripeSupportSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  metadata: { tier?: string; user_id?: string };
}

export async function listOpenStripeSubscriptions(customer: string): Promise<StripeSupportSubscription[]> {
  const subscriptions: StripeSupportSubscription[] = [];
  const query = new URLSearchParams({ customer, status: "all", limit: "100" });
  const openStatuses = new Set([...MANAGEABLE_SUBSCRIPTION_STATUSES, "incomplete"]);
  while (true) {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions?${query}`, {
      headers: { Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json() as {
      data?: Array<Partial<StripeSupportSubscription>>;
      has_more?: boolean;
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      if (payload.error?.code === "resource_missing") return subscriptions;
      throw new StripeApiError(payload.error?.message ?? "Stripe subscriptions lookup failed", payload.error?.code);
    }
    if (!Array.isArray(payload.data)) throw new StripeApiError("Invalid Stripe subscriptions response");
    for (const subscription of payload.data) {
      if (subscription.id && openStatuses.has(subscription.status ?? "")) {
        subscriptions.push({
          id: subscription.id,
          customer,
          status: subscription.status!,
          cancel_at_period_end: subscription.cancel_at_period_end === true,
          metadata: subscription.metadata ?? {},
        });
      }
    }
    if (!payload.has_more) return subscriptions;
    const cursor = payload.data.at(-1)?.id;
    if (!cursor || cursor === query.get("starting_after")) throw new StripeApiError("Invalid Stripe subscriptions cursor");
    query.set("starting_after", cursor);
  }
}

export async function scheduleSubscriptionCancellation(subscriptionId: string, customer: string, userId: string): Promise<void> {
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const subscription = await response.json() as Partial<StripeSupportSubscription> & { error?: { message?: string } };
  if (!response.ok || subscription.id !== subscriptionId || subscription.customer !== customer || subscription.metadata?.user_id !== userId) {
    throw new StripeApiError(subscription.error?.message ?? "Switch source subscription mismatch");
  }
  if (subscription.cancel_at_period_end || subscription.status === "canceled") return;
  if (subscription.status !== "active") throw new StripeApiError("Switch source subscription is not active");
  const update = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `support-switch-cancel/${subscriptionId}`,
    },
    body: new URLSearchParams({ cancel_at_period_end: "true" }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const result = await update.json() as { cancel_at_period_end?: boolean; error?: { message?: string } };
  if (!update.ok || result.cancel_at_period_end !== true) throw new StripeApiError(result.error?.message ?? "Failed to schedule source subscription cancellation");
}

async function hasSubscriptionWithStatus(customer: string, statuses: ReadonlySet<string>): Promise<boolean> {
  const query = new URLSearchParams({ customer, status: "all", limit: "100" });
  while (true) {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions?${query}`, {
      headers: { Authorization: `Bearer ${requiredEnvironment("STRIPE_SECRET_KEY")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json() as {
      data?: Array<{ id?: string; status?: string }>;
      has_more?: boolean;
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      if (payload.error?.code === "resource_missing") return false;
      throw new StripeApiError(payload.error?.message ?? "Stripe subscriptions lookup failed", payload.error?.code);
    }
    if (!Array.isArray(payload.data)) throw new StripeApiError("Invalid Stripe subscriptions response");
    if (payload.data.some((subscription) => statuses.has(subscription.status ?? ""))) return true;
    if (!payload.has_more) return false;
    const cursor = payload.data.at(-1)?.id;
    if (!cursor || cursor === query.get("starting_after")) throw new StripeApiError("Invalid Stripe subscriptions cursor");
    query.set("starting_after", cursor);
  }
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
