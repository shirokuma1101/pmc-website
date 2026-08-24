import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ApiRouteError, readJson, withRouteErrors } from "@/lib/api/route";
import { enableTwoFactor, revokeAllSessions } from "@/lib/auth/provider";
import { TFA_SETUP_COOKIE, tfaSetupCookieOptions } from "@/lib/auth/cookies";
import { clearSessionCookie, requireSession } from "@/lib/auth/session";
import { readPendingTwoFactorSetup, sealPendingTwoFactorSetup } from "@/lib/auth/tfaSetup";
import { DirectusError } from "@/lib/directus/client";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit, resetAuthAccountLimit } from "@/lib/security/rate-limit";
import { twoFactorEnableSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    enforceAuthRateLimit(request, session.user.id, AUTH_RATE_LIMITS.tfa);
    if (session.user.tfaEnabled) {
      throw new ApiRouteError(
        "2段階認証はすでに有効です。",
        409,
        "TFA_ALREADY_ENABLED",
      );
    }
    const { otp } = twoFactorEnableSchema.parse(await readJson(request));
    const cookieStore = await cookies();
    const pending = readPendingTwoFactorSetup(
      cookieStore.get(TFA_SETUP_COOKIE)?.value,
      session.accessToken,
      session.user.id,
    );
    if (!pending) {
      throw new ApiRouteError(
        "Two-factor setup has expired. Verify your password again.",
        409,
        "TFA_SETUP_EXPIRED",
      );
    }

    try {
      await enableTwoFactor(session.accessToken, pending.secret, otp);
    } catch (error) {
      if (
        error instanceof DirectusError
        && (error.code === "INVALID_OTP" || error.code === "INVALID_PAYLOAD")
      ) {
        const attemptsRemaining = pending.attemptsRemaining - 1;
        if (attemptsRemaining > 0) {
          cookieStore.set(
            TFA_SETUP_COOKIE,
            sealPendingTwoFactorSetup({ ...pending, attemptsRemaining }, session.accessToken),
            {
              ...tfaSetupCookieOptions,
              maxAge: Math.max(1, Math.ceil((pending.expiresAt - Date.now()) / 1_000)),
            },
          );
        } else {
          cookieStore.set(TFA_SETUP_COOKIE, "", { ...tfaSetupCookieOptions, maxAge: 0 });
        }
        throw new ApiRouteError(
          attemptsRemaining > 0
            ? "認証コードを確認してください。"
            : "認証コードの試行回数を超えました。パスワード確認からやり直してください。",
          401,
          attemptsRemaining > 0 ? "INVALID_OTP" : "TFA_SETUP_ATTEMPTS_EXHAUSTED",
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
    cookieStore.set(TFA_SETUP_COOKIE, "", { ...tfaSetupCookieOptions, maxAge: 0 });
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  });
}
