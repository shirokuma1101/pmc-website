import { NextResponse } from "next/server";
import { ApiRouteError, readJson, withRouteErrors } from "@/lib/api/route";
import { disableTwoFactor, revokeAllSessions } from "@/lib/auth/provider";
import { clearSessionCookie, requireSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/csrf";
import { twoFactorDisableSchema } from "@/lib/validation/schemas";
import { DirectusError } from "@/lib/directus/client";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit, resetAuthAccountLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    enforceAuthRateLimit(request, session.user.id, AUTH_RATE_LIMITS.tfa);
    if (!session.user.tfaEnabled) {
      throw new ApiRouteError(
        "2段階認証は有効になっていません。",
        409,
        "TFA_NOT_ENABLED",
      );
    }
    const { password, otp } = twoFactorDisableSchema.parse(await readJson(request));
    try {
      await disableTwoFactor(session.accessToken, password, otp);
    } catch (error) {
      if (
        error instanceof DirectusError
        && ["INVALID_CREDENTIALS", "INVALID_OTP", "INVALID_PAYLOAD"].includes(error.code)
      ) {
        throw new ApiRouteError(
          "現在のパスワードまたは認証コードを確認してください。",
          401,
          "INVALID_CREDENTIALS",
        );
      }
      throw error;
    }
    try {
      await revokeAllSessions(session.accessToken);
    } catch (error) {
      if (!(error instanceof DirectusError) || ![401, 403].includes(error.status)) throw error;
    }
    await clearSessionCookie();
    resetAuthAccountLimit("tfa", session.user.id);
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  });
}
