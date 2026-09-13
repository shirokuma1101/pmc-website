import { NextResponse } from "next/server";
import { ApiRouteError, withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { directusRequest } from "@/lib/directus/client";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { createCustomerPortalSession, hasManageableStripeSubscription, StripeApiError } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    enforceAuthRateLimit(request, session.user.id, AUTH_RATE_LIMITS.supportCheckout);
    const result = await directusRequest<{ data: { customer: string | null } }>(`/pmc-website/support-customer/${encodeURIComponent(session.user.id)}`, { headers: { "X-PMC-Stripe-Secret": process.env.STRIPE_INTERNAL_SECRET ?? "" } });
    if (!result.data.customer) throw new ApiRouteError("有効な月額サポーター契約が見つかりません。", 404, "SUBSCRIPTION_NOT_FOUND");
    if (!await hasManageableStripeSubscription(result.data.customer)) {
      throw new ApiRouteError("現在のStripe環境に有効な月額サポーター契約が見つかりません。", 404, "SUBSCRIPTION_NOT_FOUND");
    }
    try {
      return NextResponse.redirect(await createCustomerPortalSession(result.data.customer), 303);
    } catch (error) {
      if (error instanceof StripeApiError && error.code === "resource_missing") {
        throw new ApiRouteError("現在のStripe環境に有効な月額サポーター契約が見つかりません。", 404, "SUBSCRIPTION_NOT_FOUND");
      }
      throw error;
    }
  });
}
