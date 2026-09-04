import { ApiRouteError, dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { setSessionCookie } from "@/lib/auth/session";
import { directusAuthenticationProvider } from "@/lib/auth/provider";
import { DirectusError } from "@/lib/directus/client";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit, resetAuthAccountLimit } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validation/schemas";
import { turnstileTokenFrom, verifyTurnstile } from "@/lib/security/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const body = await readJson(request);
    const { email, password, otp } = loginSchema.parse(body);
    await verifyTurnstile(request, turnstileTokenFrom(body), "login");
    enforceAuthRateLimit(request, email, AUTH_RATE_LIMITS.login);
    let tokens;
    try {
      tokens = await directusAuthenticationProvider.login({
        email,
        password,
        ...(otp ? { otp } : {}),
      });
    } catch (error) {
      if (error instanceof DirectusError && error.code === "INVALID_OTP" && !otp) {
        return dataResponse({ requiresOtp: true }, 202, {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
        });
      }
      if (
        error instanceof DirectusError
        && (error.code === "INVALID_OTP" || error.code === "INVALID_CREDENTIALS")
      ) {
        throw new ApiRouteError(
          "メールアドレス、パスワードまたは認証コードを確認してください。",
          401,
          "INVALID_CREDENTIALS",
        );
      }
      throw error;
    }
    let user;
    try {
      user = await directusAuthenticationProvider.currentUser(tokens.session_token);
    } catch (error) {
      await directusAuthenticationProvider.logout(tokens.session_token).catch(() => undefined);
      throw error;
    }
    await setSessionCookie(tokens);
    resetAuthAccountLimit("login", email);
    return dataResponse({ user }, 200, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
}
