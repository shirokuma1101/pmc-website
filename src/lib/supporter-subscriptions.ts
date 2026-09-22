import "server-only";

import { directusRequest } from "@/lib/directus/client";
import { hasManageableStripeSubscription, hasOpenStripeSubscription } from "@/lib/stripe";

/** Check every recorded customer: a later canceled subscription must not hide an older active one. */
export async function findSupporterSubscriptionCustomer(userId: string, includeIncomplete = false): Promise<string | null> {
  const result = await directusRequest<{ data: { customer: string | null; customers?: string[] } }>(
    `/pmc-website/support-customer/${encodeURIComponent(userId)}`,
    { headers: { "X-PMC-Stripe-Secret": process.env.STRIPE_INTERNAL_SECRET ?? "" } },
  );
  const customers = result.data.customers ?? (result.data.customer ? [result.data.customer] : []);
  const check = includeIncomplete ? hasOpenStripeSubscription : hasManageableStripeSubscription;
  for (const customer of new Set(customers)) {
    if (await check(customer)) return customer;
  }
  return null;
}
