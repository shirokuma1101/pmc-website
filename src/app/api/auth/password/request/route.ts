import { NextResponse } from "next/server";
import { readJson, withRouteErrors } from "@/lib/api/route";
import { requestPasswordResetDirectus } from "@/lib/auth/provider";
import { getPublicAppUrl } from "@/lib/config";
import { DirectusError } from "@/lib/directus/client";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { passwordResetRequestSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const { email } = passwordResetRequestSchema.parse(await readJson(request));
    enforceAuthRateLimit(request, email, AUTH_RATE_LIMITS.passwordResetRequest);
    try {
      await requestPasswordResetDirectus(email, `${getPublicAppUrl()}/reset-password`);
    } catch (error) {
      // Do not reveal whether an account exists or is eligible for password reset.
      if (!(error instanceof DirectusError) || error.status >= 500) throw error;
    }
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  });
}
