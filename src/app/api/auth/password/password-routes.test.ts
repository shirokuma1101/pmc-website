import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/provider", () => ({
  requestPasswordResetDirectus: vi.fn(),
  resetPasswordDirectus: vi.fn(),
}));
vi.mock("@/lib/security/turnstile", () => ({
  turnstileProtectedInputFrom: (body: Record<string, unknown>) => body,
  turnstileTokenFrom: () => "test-token",
  verifyTurnstile: vi.fn().mockResolvedValue(undefined),
}));

import { requestPasswordResetDirectus, resetPasswordDirectus } from "@/lib/auth/provider";
import { DirectusError } from "@/lib/directus/client";
import { clearAuthRateLimitsForTests } from "@/lib/security/rate-limit";
import { POST as requestReset } from "./request/route";
import { POST as resetPassword } from "./reset/route";

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
    body: JSON.stringify(body),
  });
}

describe("password reset routes", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3001";
    delete process.env.AUTH_RATE_LIMIT_TRUST_PROXY;
    clearAuthRateLimitsForTests();
    vi.mocked(requestPasswordResetDirectus).mockReset().mockResolvedValue(undefined);
    vi.mocked(resetPasswordDirectus).mockReset().mockResolvedValue(undefined);
  });

  it("requests a reset using the fixed application URL", async () => {
    const response = await requestReset(jsonRequest("/api/auth/password/request", {
      email: "member@example.com",
    }));
    expect(response.status).toBe(204);
    expect(requestPasswordResetDirectus).toHaveBeenCalledWith(
      "member@example.com",
      "http://localhost:3001/reset-password",
    );
  });

  it("does not disclose an ineligible or unknown account", async () => {
    vi.mocked(requestPasswordResetDirectus).mockRejectedValue(
      new DirectusError("Forbidden", 403, "FORBIDDEN"),
    );
    const response = await requestReset(jsonRequest("/api/auth/password/request", {
      email: "unknown@example.com",
    }));
    expect(response.status).toBe(204);
  });

  it("resets a password without returning the token", async () => {
    const response = await resetPassword(jsonRequest("/api/auth/password/reset", {
      token: "reset-token",
      password: "a-long-new-password",
    }));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(resetPasswordDirectus).toHaveBeenCalledWith("reset-token", "a-long-new-password");
  });

  it("maps an expired token to a stable public error", async () => {
    vi.mocked(resetPasswordDirectus).mockRejectedValue(
      new DirectusError("Invalid token", 401, "INVALID_TOKEN"),
    );
    const response = await resetPassword(jsonRequest("/api/auth/password/reset", {
      token: "expired-token",
      password: "a-long-new-password",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_RESET_TOKEN" },
    });
  });
});
