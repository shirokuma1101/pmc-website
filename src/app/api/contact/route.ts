import { NextResponse } from "next/server";
import { ApiRouteError, readJson, withRouteErrors } from "@/lib/api/route";
import { resolveContactRecipient } from "@/lib/contact/recipients";
import { sendContactInquiryEmail } from "@/lib/email/resend";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { turnstileProtectedInputFrom, turnstileTokenFrom, verifyTurnstile } from "@/lib/security/turnstile";
import { contactInquirySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const body = await readJson(request);
    const input = contactInquirySchema.parse(turnstileProtectedInputFrom(body));
    const recipient = resolveContactRecipient(input.recipientId);
    if (!recipient) throw new ApiRouteError("送信先を選び直してください。", 400, "INVALID_RECIPIENT");
    enforceAuthRateLimit(request, input.email, AUTH_RATE_LIMITS.contactInquiry);
    await verifyTurnstile(request, turnstileTokenFrom(body), "contact-inquiry");
    await sendContactInquiryEmail(input, recipient);
    return NextResponse.json({ data: { submitted: true, submissionId: input.submissionId } }, { status: 201 });
  });
}
