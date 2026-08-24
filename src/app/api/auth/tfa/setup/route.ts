import QRCode from "qrcode";
import { ApiRouteError, dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { generateTwoFactorSetup } from "@/lib/auth/provider";
import { TFA_SETUP_COOKIE, tfaSetupCookieOptions } from "@/lib/auth/cookies";
import { requireSession } from "@/lib/auth/session";
import { createPendingTwoFactorSetup } from "@/lib/auth/tfaSetup";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit, resetAuthAccountLimit } from "@/lib/security/rate-limit";
import { twoFactorSetupSchema } from "@/lib/validation/schemas";
import { DirectusError } from "@/lib/directus/client";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    enforceAuthRateLimit(request, session.user.id, AUTH_RATE_LIMITS.tfa);
    if (session.user.tfaEnabled) {
      throw new ApiRouteError(
        "2段階認証はすでに有効です。変更する場合は一度無効にしてください。",
        409,
        "TFA_ALREADY_ENABLED",
      );
    }
    const { password } = twoFactorSetupSchema.parse(await readJson(request));
    let setup;
    try {
      setup = await generateTwoFactorSetup(session.accessToken, password);
    } catch (error) {
      if (error instanceof DirectusError && error.code === "INVALID_CREDENTIALS") {
        throw new ApiRouteError(
          "現在のパスワードを確認してください。",
          401,
          "INVALID_CREDENTIALS",
        );
      }
      throw error;
    }
    const qrDataUrl = await QRCode.toDataURL(setup.otpauthUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: { dark: "#232b27", light: "#fffdf8" },
    });

    const response = dataResponse({ secret: setup.secret, qrDataUrl }, 200, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
    response.cookies.set(
      TFA_SETUP_COOKIE,
      createPendingTwoFactorSetup(session.user.id, setup.secret, session.accessToken),
      tfaSetupCookieOptions,
    );
    resetAuthAccountLimit("tfa", session.user.id);
    return response;
  });
}
