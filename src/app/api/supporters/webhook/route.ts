import { ApiRouteError, withRouteErrors } from "@/lib/api/route";
import { directusRequest } from "@/lib/directus/client";
import { verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED_EVENTS = new Set(["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted"]);

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new ApiRouteError("Stripe signature is required", 400, "INVALID_SIGNATURE");
    try { verifyStripeSignature(payload, signature); } catch { throw new ApiRouteError("Stripe signature verification failed", 400, "INVALID_SIGNATURE"); }
    const event = JSON.parse(payload) as { id?: string; type?: string; livemode?: boolean; data?: { object?: unknown } };
    const expectedLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false;
    if (!event.id || !event.type || event.livemode !== expectedLiveMode) throw new ApiRouteError("Stripe event mode is invalid", 400, "INVALID_EVENT");
    if (!ACCEPTED_EVENTS.has(event.type)) return new Response(null, { status: 204 });
    await directusRequest("/pmc-website/support-events", {
      method: "POST",
      headers: { "X-PMC-Stripe-Secret": process.env.STRIPE_INTERNAL_SECRET ?? "" },
      body: { id: event.id, type: event.type, livemode: event.livemode, object: event.data?.object },
    });
    return new Response(null, { status: 204 });
  });
}
