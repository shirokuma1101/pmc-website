import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  AuthRateLimitError,
  clearAuthRateLimitsForTests,
  enforceAuthRateLimit,
  resetAuthAccountLimit,
} from "./rate-limit";
import { withRouteErrors } from "@/lib/api/route";

const policy = { action: "login", accountLimit: 2, ipLimit: 3, windowMs: 60_000 } as const;

function request(ip: string) {
  return new Request("https://pmc.example.com/api/auth/login", {
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });
}

describe("authentication rate limit", () => {
  beforeEach(() => {
    process.env.AUTH_RATE_LIMIT_TRUST_PROXY = "true";
    clearAuthRateLimitsForTests();
  });

  afterEach(() => {
    delete process.env.AUTH_RATE_LIMIT_TRUST_PROXY;
  });

  it("limits repeated attempts for the same normalized account", () => {
    enforceAuthRateLimit(request("203.0.113.1"), "Member@Example.com", policy, 1_000);
    enforceAuthRateLimit(request("203.0.113.2"), "member@example.com", policy, 1_000);
    expect(() => enforceAuthRateLimit(request("203.0.113.3"), "member@example.com", policy, 1_000))
      .toThrow(AuthRateLimitError);
  });

  it("limits an IP across different accounts and exposes retry seconds", () => {
    enforceAuthRateLimit(request("203.0.113.4"), "one@example.com", policy, 1_000);
    enforceAuthRateLimit(request("203.0.113.4"), "two@example.com", policy, 1_000);
    enforceAuthRateLimit(request("203.0.113.4"), "three@example.com", policy, 1_000);
    try {
      enforceAuthRateLimit(request("203.0.113.4"), "four@example.com", policy, 1_000);
      expect.fail("Expected rate limiting");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthRateLimitError);
      expect((error as AuthRateLimitError).retryAfter).toBe(60);
    }
  });

  it("can reset an account after successful authentication", () => {
    enforceAuthRateLimit(request("203.0.113.5"), "member@example.com", policy, 1_000);
    enforceAuthRateLimit(request("203.0.113.6"), "member@example.com", policy, 1_000);
    resetAuthAccountLimit("login", "member@example.com");
    expect(() => enforceAuthRateLimit(request("203.0.113.7"), "member@example.com", policy, 1_000))
      .not.toThrow();
  });

  it("starts a new window after expiration", () => {
    enforceAuthRateLimit(request("203.0.113.8"), "member@example.com", policy, 1_000);
    enforceAuthRateLimit(request("203.0.113.9"), "member@example.com", policy, 1_000);
    expect(() => enforceAuthRateLimit(request("203.0.113.10"), "member@example.com", policy, 61_001))
      .not.toThrow();
  });

  it("does not trust a client-supplied forwarding header by default", () => {
    delete process.env.AUTH_RATE_LIMIT_TRUST_PROXY;
    enforceAuthRateLimit(request("203.0.113.11"), "one@example.com", policy, 1_000);
    enforceAuthRateLimit(request("203.0.113.12"), "two@example.com", policy, 1_000);
    enforceAuthRateLimit(request("203.0.113.13"), "three@example.com", policy, 1_000);
    expect(() => enforceAuthRateLimit(request("203.0.113.14"), "four@example.com", policy, 1_000))
      .toThrow(AuthRateLimitError);
  });

  it("returns a non-cacheable 429 response with Retry-After", async () => {
    const response = await withRouteErrors(async () => {
      throw new AuthRateLimitError(42);
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
