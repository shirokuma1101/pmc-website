import { NextResponse } from "next/server";
import { z } from "zod";
import { withRouteErrors, ApiRouteError } from "@/lib/api/route";
import { getSession } from "@/lib/auth/session";
import { MAX_ONE_TIME_SUPPORT_QUANTITY, MONTHLY_SUPPORTER_PLANS, ONE_TIME_SUPPORT } from "@/lib/organization/supporter";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("one_time"), tier: z.literal("standard"), quantity: z.coerce.number().int().min(1).max(MAX_ONE_TIME_SUPPORT_QUANTITY) }),
  z.object({ frequency: z.literal("monthly"), tier: z.enum(["basic", "standard", "premium"]) }),
]);

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    if (!stripeEnabled()) throw new ApiRouteError("Stripe checkout is not configured", 503, "CHECKOUT_UNAVAILABLE");
    const session = await getSession();
    enforceAuthRateLimit(request, session?.user.id ?? "anonymous", AUTH_RATE_LIMITS.supportCheckout);
    const form = await request.formData();
    const parsed = schema.parse({ frequency: form.get("frequency"), tier: form.get("tier"), quantity: form.get("quantity") });
    if (form.get("consent") !== "accepted") throw new ApiRouteError("Consent is required", 400, "CONSENT_REQUIRED");

    let amount: number;
    let tier: "basic" | "standard" | "premium";
    if (parsed.frequency === "monthly") {
      if (!session) throw new ApiRouteError("Login is required for monthly support", 401, "AUTH_REQUIRED");
      tier = parsed.tier;
      amount = MONTHLY_SUPPORTER_PLANS[tier].amount;
    } else {
      if (!session) throw new ApiRouteError("Login is required to receive Standard Supporter benefits", 401, "AUTH_REQUIRED");
      amount = ONE_TIME_SUPPORT.amount;
      tier = ONE_TIME_SUPPORT.tier;
    }
    const url = await createCheckoutSession({ frequency: parsed.frequency, amount, tier, userId: session?.user.id, quantity: parsed.frequency === "one_time" ? parsed.quantity : 1 });
    return NextResponse.redirect(url, 303);
  });
}
