import { NextResponse } from "next/server";
import { ApiRouteError, readJson, withRouteErrors } from "@/lib/api/route";
import { registerDirectus } from "@/lib/auth/provider";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { registrationSchema } from "@/lib/validation/schemas";
import { turnstileProtectedInputFrom, turnstileTokenFrom, verifyTurnstile } from "@/lib/security/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    if (process.env.REGISTRATION_ENABLED !== "true") {
      throw new ApiRouteError("現在、新規登録を受け付けていません。", 403, "REGISTRATION_DISABLED");
    }
    const body = await readJson(request);
    const input = registrationSchema.parse(turnstileProtectedInputFrom(body));
    await verifyTurnstile(request, turnstileTokenFrom(body), "registration");
    enforceAuthRateLimit(request, input.email, AUTH_RATE_LIMITS.registration);
    await registerDirectus(input);
    return NextResponse.json({ data: { registered: true } }, { status: 201 });
  });
}
