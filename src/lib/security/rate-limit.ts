import { createHash } from "node:crypto";
import { isIP } from "node:net";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitState {
  entries: Map<string, RateLimitEntry>;
  lastCleanupAt: number;
}

export interface AuthRateLimitPolicy {
  action: "login" | "registration" | "tfa" | "password-reset-request" | "password-reset";
  accountLimit: number;
  ipLimit: number;
  windowMs: number;
}

export const AUTH_RATE_LIMITS = {
  login: { action: "login", accountLimit: 10, ipLimit: 30, windowMs: 15 * 60_000 },
  registration: { action: "registration", accountLimit: 3, ipLimit: 5, windowMs: 60 * 60_000 },
  tfa: { action: "tfa", accountLimit: 10, ipLimit: 30, windowMs: 15 * 60_000 },
  passwordResetRequest: {
    action: "password-reset-request",
    accountLimit: 3,
    ipLimit: 5,
    windowMs: 60 * 60_000,
  },
  passwordReset: {
    action: "password-reset",
    accountLimit: 10,
    ipLimit: 30,
    windowMs: 15 * 60_000,
  },
} as const satisfies Record<string, AuthRateLimitPolicy>;

const runtime = globalThis as typeof globalThis & { __pmcAuthRateLimit?: RateLimitState };
const state = runtime.__pmcAuthRateLimit ??= { entries: new Map(), lastCleanupAt: Date.now() };

export class AuthRateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  readonly status = 429;

  constructor(public readonly retryAfter: number) {
    super("試行回数が多すぎます。しばらく待ってから再度お試しください。");
    this.name = "AuthRateLimitError";
  }
}

function clientIp(request: Request): string {
  if (process.env.AUTH_RATE_LIMIT_TRUST_PROXY !== "true") return "untrusted-client";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip")?.trim();
  return candidate && isIP(candidate) ? candidate : "unknown-client";
}

function accountHash(identifier: string): string {
  return createHash("sha256").update(identifier.trim().toLocaleLowerCase()).digest("hex");
}

function cleanup(now: number) {
  if (now - state.lastCleanupAt < 5 * 60_000) return;
  for (const [key, entry] of state.entries) {
    if (entry.resetAt <= now) state.entries.delete(key);
  }
  state.lastCleanupAt = now;
}

function consume(key: string, limit: number, windowMs: number, now: number): number | null {
  const current = state.entries.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  entry.count += 1;
  state.entries.set(key, entry);
  return entry.count > limit ? Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)) : null;
}

export function enforceAuthRateLimit(
  request: Request,
  identifier: string,
  policy: AuthRateLimitPolicy,
  now = Date.now(),
): void {
  cleanup(now);
  const ipRetry = consume(`${policy.action}:ip:${clientIp(request)}`, policy.ipLimit, policy.windowMs, now);
  const accountRetry = consume(
    `${policy.action}:account:${accountHash(identifier)}`,
    policy.accountLimit,
    policy.windowMs,
    now,
  );
  const retryAfter = Math.max(ipRetry ?? 0, accountRetry ?? 0);
  if (retryAfter > 0) throw new AuthRateLimitError(retryAfter);
}

export function resetAuthAccountLimit(action: AuthRateLimitPolicy["action"], identifier: string): void {
  state.entries.delete(`${action}:account:${accountHash(identifier)}`);
}

export function clearAuthRateLimitsForTests(): void {
  state.entries.clear();
  state.lastCleanupAt = Date.now();
}
