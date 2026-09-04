import "server-only";

import { isIP } from "node:net";
import { ApiRouteError } from "@/lib/api/route";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

export type TurnstileAction =
  | "login"
  | "registration"
  | "google-sso"
  | "x-sso"
  | "password-reset-request";

export function turnstileTokenFrom(body: unknown): unknown {
  return body && typeof body === "object" ? (body as Record<string, unknown>).turnstileToken : undefined;
}

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
}

function clientIp(request: Request): string | undefined {
  if (process.env.AUTH_RATE_LIMIT_TRUST_PROXY !== "true") return undefined;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : undefined;
}

function verificationError(): ApiRouteError {
  return new ApiRouteError(
    "セキュリティ確認に失敗しました。ウィジェットを再読み込みして、もう一度お試しください。",
    400,
    "TURNSTILE_FAILED",
  );
}

export async function verifyTurnstile(
  request: Request,
  token: unknown,
  expectedAction: TurnstileAction,
): Promise<void> {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) throw verificationError();
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw verificationError();

  const body = new URLSearchParams({ secret, response: token });
  const remoteip = clientIp(request);
  if (remoteip) body.set("remoteip", remoteip);

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw verificationError();
  }

  if (!response.ok) throw verificationError();
  let result: SiteverifyResponse;
  try {
    result = await response.json() as SiteverifyResponse;
  } catch {
    throw verificationError();
  }
  if (result.success !== true || result.action !== expectedAction) throw verificationError();
}
