import { ApiRouteError, dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { assertSameOrigin } from "@/lib/security/csrf";
import { AUTH_RATE_LIMITS, enforceAuthRateLimit } from "@/lib/security/rate-limit";
import { turnstileTokenFrom, verifyTurnstile, type TurnstileAction } from "@/lib/security/turnstile";

export const runtime = "nodejs";

const providers = {
  google: { action: "google-sso", environment: "GOOGLE_SSO_AUTH_URL" },
  x: { action: "x-sso", environment: "X_SSO_AUTH_URL" },
} as const satisfies Record<string, { action: TurnstileAction; environment: string }>;

export async function POST(
  request: Request,
  context: RouteContext<"/api/auth/sso/[provider]">,
): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const { provider } = await context.params;
    const configuration = providers[provider as keyof typeof providers];
    if (!configuration) throw new ApiRouteError("対応していない認証方法です。", 404, "SSO_NOT_FOUND");
    const authorizationUrl = process.env[configuration.environment];
    if (!authorizationUrl) throw new ApiRouteError("この認証方法は現在利用できません。", 503, "SSO_UNAVAILABLE");
    let parsedAuthorizationUrl: URL;
    try {
      parsedAuthorizationUrl = new URL(authorizationUrl);
    } catch {
      throw new ApiRouteError("この認証方法は現在利用できません。", 503, "SSO_UNAVAILABLE");
    }
    if (parsedAuthorizationUrl.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new ApiRouteError("この認証方法は現在利用できません。", 503, "SSO_UNAVAILABLE");
    }
    const body = await readJson(request);
    await verifyTurnstile(request, turnstileTokenFrom(body), configuration.action);
    enforceAuthRateLimit(request, provider, AUTH_RATE_LIMITS.sso);
    return dataResponse({ authorizationUrl: parsedAuthorizationUrl.href }, 200, { "Cache-Control": "private, no-store" });
  });
}
