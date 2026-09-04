import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/csrf", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/security/csrf")>(),
  assertSameOrigin: vi.fn(),
}));
vi.mock("@/lib/security/turnstile", () => ({
  turnstileTokenFrom: (body: Record<string, unknown>) => body.turnstileToken,
  verifyTurnstile: vi.fn().mockResolvedValue(undefined),
}));

import { verifyTurnstile } from "@/lib/security/turnstile";
import { clearAuthRateLimitsForTests } from "@/lib/security/rate-limit";
import { POST } from "./route";

function request() {
  return new Request("http://localhost:3001/api/auth/sso/google", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
    body: JSON.stringify({ turnstileToken: "test-token" }),
  });
}

function context(provider: string) {
  return { params: Promise.resolve({ provider }) } as RouteContext<"/api/auth/sso/[provider]">;
}

describe("SSO start route", () => {
  beforeEach(() => {
    clearAuthRateLimitsForTests();
    process.env.GOOGLE_SSO_AUTH_URL = "https://identity.example.com/google";
    vi.mocked(verifyTurnstile).mockClear();
  });

  afterEach(() => {
    delete process.env.GOOGLE_SSO_AUTH_URL;
  });

  it("verifies the provider-specific action before returning its configured URL", async () => {
    const response = await POST(request(), context("google"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { authorizationUrl: "https://identity.example.com/google" },
    });
    expect(verifyTurnstile).toHaveBeenCalledWith(expect.any(Request), "test-token", "google-sso");
  });

  it("fails closed when the provider is not configured", async () => {
    delete process.env.GOOGLE_SSO_AUTH_URL;
    const response = await POST(request(), context("google"));
    expect(response.status).toBe(503);
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it("rejects unknown providers", async () => {
    const response = await POST(request(), context("unknown"));
    expect(response.status).toBe(404);
  });
});
