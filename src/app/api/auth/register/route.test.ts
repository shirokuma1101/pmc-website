import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/csrf", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/security/csrf")>(),
  assertSameOrigin: vi.fn(),
}));
vi.mock("@/lib/auth/provider", () => ({ registerDirectus: vi.fn() }));
vi.mock("@/lib/security/turnstile", () => ({
  turnstileProtectedInputFrom: (body: Record<string, unknown>) => body,
  turnstileTokenFrom: () => "test-token",
  verifyTurnstile: vi.fn().mockResolvedValue(undefined),
}));

import { registerDirectus } from "@/lib/auth/provider";
import { POST } from "./route";

const validBody = {
  displayName: "New Member",
  email: "new@example.com",
  password: "long-password-123",
};

function request(body: unknown) {
  return new Request("http://localhost:3001/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("registration route", () => {
  beforeEach(() => {
    vi.mocked(registerDirectus).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.REGISTRATION_ENABLED;
  });

  it("fails closed while registration is disabled", async () => {
    process.env.REGISTRATION_ENABLED = "false";
    const response = await POST(request(validBody));

    expect(response.status).toBe(403);
    expect(registerDirectus).not.toHaveBeenCalled();
  });

  it("passes only validated public fields to the fixed registration provider", async () => {
    process.env.REGISTRATION_ENABLED = "true";
    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(registerDirectus).toHaveBeenCalledWith(validBody);
  });

  it("rejects client-supplied role and status fields", async () => {
    process.env.REGISTRATION_ENABLED = "true";
    const response = await POST(request({ ...validBody, role: "Administrator", status: "active" }));

    expect(response.status).toBe(400);
    expect(registerDirectus).not.toHaveBeenCalled();
  });
});
