import { NextResponse } from "next/server";
import { z } from "zod";
import { withRouteErrors, ApiRouteError } from "@/lib/api/route";
import { getSession } from "@/lib/auth/session";
import { MONTHLY_SUPPORTER_PLANS, ONE_TIME_SUPPORT } from "@/lib/organization/supporter";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { findSupporterSubscriptionCustomer } from "@/lib/supporter-subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("one_time"), tier: z.literal("supporter") }),
  z.object({ frequency: z.literal("monthly"), tier: z.enum(["basic", "standard", "premium"]) }),
]);

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    if (!stripeEnabled()) throw new ApiRouteError("Stripe checkout is not configured", 503, "CHECKOUT_UNAVAILABLE");
    const session = await getSession();
    enforceAuthRateLimit(request, session?.user.id ?? "anonymous", AUTH_RATE_LIMITS.supportCheckout);
    const form = await request.formData();
    const parsed = schema.parse({ frequency: form.get("frequency"), tier: form.get("tier") });
    if (form.get("consent") !== "accepted") throw new ApiRouteError("Consent is required", 400, "CONSENT_REQUIRED");

    let amount: number;
    let tier: "supporter" | "basic" | "standard" | "premium";
    if (parsed.frequency === "monthly") {
      if (!session) throw new ApiRouteError("Login is required for monthly support", 401, "AUTH_REQUIRED");
      if (await findSupporterSubscriptionCustomer(session.user.id, true)) {
        throw new ApiRouteError("月額契約またはお支払い手続き中の契約があります。支払い方法・月額プランの管理画面をご確認ください。", 409, "SUBSCRIPTION_EXISTS");
      }
      tier = parsed.tier;
      amount = MONTHLY_SUPPORTER_PLANS[tier].amount;
    } else {
      if (!session) throw new ApiRouteError("Login is required to receive Supporter benefits", 401, "AUTH_REQUIRED");
      tier = ONE_TIME_SUPPORT.tier;
      amount = ONE_TIME_SUPPORT.amount;
    }
    const requestId = z.uuid().optional().parse(form.get("requestId") ?? undefined);
    const url = await createCheckoutSession({ frequency: parsed.frequency, amount, tier, userId: session?.user.id, email: session?.user.email, quantity: 1, ...(requestId ? { requestId } : {}) });
    if (request.headers.get("accept")?.includes("application/json")) return NextResponse.json({ data: { url } });
    return NextResponse.redirect(url, 303);
  });
}
