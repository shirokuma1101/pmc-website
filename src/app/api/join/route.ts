import { NextResponse } from "next/server";
import { readJson, withRouteErrors } from "@/lib/api/route";
import { sendJoinApplicationEmail } from "@/lib/email/resend";
import { createJoinApplication } from "@/lib/directus/join-applications";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { turnstileProtectedInputFrom, turnstileTokenFrom, verifyTurnstile } from "@/lib/security/turnstile";
import { joinApplicationSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const body = await readJson(request);
    const input = joinApplicationSchema.parse(turnstileProtectedInputFrom(body));
    await verifyTurnstile(request, turnstileTokenFrom(body), "join-application");
    enforceAuthRateLimit(request, input.email, AUTH_RATE_LIMITS.joinApplication);
    await createJoinApplication(input);
    await sendJoinApplicationEmail(input, input.submissionId);
    return NextResponse.json({ data: { submitted: true } }, { status: 201 });
  });
}
