import { NextResponse } from "next/server";
import { z } from "zod";
import { withRouteErrors, ApiRouteError } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { MONTHLY_SUPPORTER_PLANS } from "@/lib/organization/supporter";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { createCheckoutSession, stripeEnabled, StripeApiError } from "@/lib/stripe";
import { findSwitchableSubscription } from "@/lib/supporter-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.enum(["basic", "standard", "premium"]);

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    if (!stripeEnabled()) throw new ApiRouteError("Stripe checkout is not configured", 503, "CHECKOUT_UNAVAILABLE");
    const session = await requireSession();
    enforceAuthRateLimit(request, session.user.id, AUTH_RATE_LIMITS.supportCheckout);
    const form = await request.formData();
    const tier = schema.parse(form.get("tier"));
    if (form.get("consent") !== "accepted") throw new ApiRouteError("Consent is required", 400, "CONSENT_REQUIRED");
    if (form.get("adultConfirmed") !== "accepted") throw new ApiRouteError("未成年者はお申し込みいただけません。", 400, "AGE_REQUIREMENT_NOT_MET");
    const source = await findSwitchableSubscription(session.user.id);
    if (!source) throw new ApiRouteError("切替可能な月額契約が1件だけあることを確認できません。契約状況をご確認ください。", 409, "SUBSCRIPTION_SWITCH_UNAVAILABLE");
    if (source.tier === tier) throw new ApiRouteError("現在と同じプランです。", 400, "SAME_SUPPORTER_PLAN");
    let url: string;
    try {
      url = await createCheckoutSession({
        frequency: "monthly",
        tier,
        amount: MONTHLY_SUPPORTER_PLANS[tier].amount,
        userId: session.user.id,
        customer: source.customer,
        switchFromSubscription: source.id,
        quantity: 1,
      });
    } catch (error) {
      if (error instanceof StripeApiError && error.code === "idempotency_error") {
        throw new ApiRouteError("別プランへの切替手続きが進行中です。既に開いた決済画面を確認するか、翌日以降に再度お試しください。", 409, "SWITCH_IN_PROGRESS");
      }
      throw error;
    }
    if (request.headers.get("accept")?.includes("application/json")) return NextResponse.json({ data: { url } });
    return NextResponse.redirect(url, 303);
  });
}
