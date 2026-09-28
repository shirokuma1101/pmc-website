import "server-only";

import { directusRequest } from "@/lib/directus/client";
import { hasManageableStripeSubscription, hasOpenStripeSubscription, listOpenStripeSubscriptions, type StripeSupportSubscription } from "@/lib/stripe";
import { MONTHLY_SUPPORTER_PLANS, type MonthlySupporterTier } from "@/lib/organization/supporter";

async function recordedCustomers(userId: string): Promise<string[]> {
  const result = await directusRequest<{ data: { customer: string | null; customers?: string[] } }>(
    `/pmc-website/support-customer/${encodeURIComponent(userId)}`,
    { headers: { "X-PMC-Stripe-Secret": process.env.STRIPE_INTERNAL_SECRET ?? "" } },
  );
  return [...new Set(result.data.customers ?? (result.data.customer ? [result.data.customer] : []))];
}

/** Check every recorded customer: a later canceled subscription must not hide an older active one. */
export async function findSupporterSubscriptionCustomer(userId: string, includeIncomplete = false): Promise<string | null> {
  const check = includeIncomplete ? hasOpenStripeSubscription : hasManageableStripeSubscription;
  for (const customer of await recordedCustomers(userId)) {
    if (await check(customer)) return customer;
  }
  return null;
}

export async function findSwitchableSubscription(userId: string): Promise<(StripeSupportSubscription & { tier: MonthlySupporterTier }) | null> {
  const subscriptions = (await Promise.all((await recordedCustomers(userId)).map(listOpenStripeSubscriptions))).flat();
  // A completed switch keeps the old paid subscription active until period end.
  // Only a subscription that will renew can be the source of another switch.
  const renewable = subscriptions.filter((subscription) => !subscription.cancel_at_period_end);
  if (renewable.length !== 1) return null;
  const subscription = renewable[0];
  const tier = subscription.metadata.tier;
  if (subscription.status !== "active" || subscription.cancel_at_period_end || subscription.metadata.user_id !== userId || !tier || !(tier in MONTHLY_SUPPORTER_PLANS)) return null;
  return { ...subscription, tier: tier as MonthlySupporterTier };
}
