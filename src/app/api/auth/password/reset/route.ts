import { NextResponse } from "next/server";
import { ApiRouteError, readJson, withRouteErrors } from "@/lib/api/route";
import { resetPasswordDirectus } from "@/lib/auth/provider";
import { DirectusError } from "@/lib/directus/client";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit, resetAuthAccountLimit } from "@/lib/security/rate-limit";
import { passwordResetSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const { token, password } = passwordResetSchema.parse(await readJson(request));
    enforceAuthRateLimit(request, token, AUTH_RATE_LIMITS.passwordReset);
    try {
      await resetPasswordDirectus(token, password);
    } catch (error) {
      if (error instanceof DirectusError && [400, 401, 403].includes(error.status)) {
        throw new ApiRouteError(
          "再設定リンクが無効または期限切れです。新しいリンクを発行してください。",
          400,
          "INVALID_RESET_TOKEN",
        );
      }
      throw error;
    }
    resetAuthAccountLimit("password-reset", token);
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  });
}
