import { ApiRouteError, withRouteErrors } from "@/lib/api/route";
import { directusRequest } from "@/lib/directus/client";
import { sendSupporterPaymentEmail, supporterPaymentNotificationKey, type StripeSupportEmailEvent } from "@/lib/email/resend";
import { verifyStripeSignature } from "@/lib/stripe";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new ApiRouteError("Stripe signature is required", 400, "INVALID_SIGNATURE");
    try { verifyStripeSignature(payload, signature); } catch { throw new ApiRouteError("Stripe signature verification failed", 400, "INVALID_SIGNATURE"); }
    let parsed: unknown;
    try { parsed = JSON.parse(payload); } catch { throw new ApiRouteError("Invalid Stripe event JSON", 400, "INVALID_EVENT"); }
    const event = z.object({
      id: z.string().min(1).max(255), type: z.string(), livemode: z.boolean(), created: z.number().int().nonnegative(),
      data: z.object({ object: z.object({ id: z.string().min(1).max(255) }).passthrough() }),
    }).parse(parsed);
    const expectedLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ?? false;
    if (!event.id || !event.type || event.livemode !== expectedLiveMode) throw new ApiRouteError("Stripe event mode is invalid", 400, "INVALID_EVENT");
    if (!ACCEPTED_EVENTS.has(event.type)) return new Response(null, { status: 204 });
    const emailEvent = { id: event.id, type: event.type, object: event.data.object } as StripeSupportEmailEvent;
    const notificationKey = supporterPaymentNotificationKey(emailEvent);
    const result = await directusRequest<{ data: { notificationSent: boolean; notificationObsolete?: boolean } }>("/pmc-website/support-events", {
      method: "POST",
      headers: { "X-PMC-Stripe-Secret": process.env.STRIPE_INTERNAL_SECRET ?? "" },
      body: { id: event.id, type: event.type, livemode: event.livemode, created: event.created, object: event.data.object, notificationKey },
    });
    // Require the storage acknowledgement before sending: an older extension must not silently skip the ledger.
    if (!result?.data || typeof result.data.notificationSent !== "boolean") {
      throw new ApiRouteError("Payment notification storage is unavailable", 503, "NOTIFICATION_STORAGE_UNAVAILABLE");
    }
    if (notificationKey && !result.data.notificationSent && !result.data.notificationObsolete) {
      const emailId = await sendSupporterPaymentEmail(emailEvent);
      if (!emailId) throw new ApiRouteError("Payment notification was not sent", 503, "NOTIFICATION_NOT_SENT");
      await directusRequest("/pmc-website/support-email-sent", {
        method: "POST", headers: { "X-PMC-Stripe-Secret": process.env.STRIPE_INTERNAL_SECRET ?? "" },
        body: { id: event.id, notificationKey, emailId },
      });
    }
    return new Response(null, { status: 204 });
  });
}
