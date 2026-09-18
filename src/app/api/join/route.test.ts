import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/security/rate-limit", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/security/rate-limit")>(),
  AUTH_RATE_LIMITS: { joinApplication: { action: "join-application" } },
  enforceAuthRateLimit: vi.fn(),
}));
vi.mock("@/lib/security/turnstile", () => ({
  turnstileProtectedInputFrom: (body: Record<string, unknown>) => {
    const input = { ...body };
    delete input.turnstileToken;
    return input;
  },
  turnstileTokenFrom: (body: Record<string, unknown>) => body.turnstileToken,
  verifyTurnstile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email/resend", () => ({ sendJoinApplicationEmail: vi.fn().mockResolvedValue("email-id") }));
vi.mock("@/lib/directus/join-applications", () => ({ createJoinApplication: vi.fn().mockResolvedValue(undefined) }));

import { sendJoinApplicationEmail } from "@/lib/email/resend";
import { POST } from "./route";

const validBody = {
  submissionId: "7e06c851-552d-45e7-8d3e-a8f07636213c",
  displayName: "しろくま",
  email: "join@example.com",
  minecraftGamertag: "PostMinePlayer",
  discordUsername: "postmine_user",
  motivation: "建築イベントに参加したいです。",
  ageRequirement: true,
  minecraftRequirement: true,
  policyConsent: true,
  turnstileToken: "test-token",
};

function request(body: unknown) {
  return new Request("http://localhost:3001/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
    body: JSON.stringify(body),
  });
}

describe("join application route", () => {
  beforeEach(() => vi.mocked(sendJoinApplicationEmail).mockClear());

  it("sends validated application data through Resend", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(201);
    expect(sendJoinApplicationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "join@example.com", displayName: "しろくま" }),
      validBody.submissionId,
    );
  });

  it("rejects missing consent without sending", async () => {
    const response = await POST(request({ ...validBody, policyConsent: false }));
    expect(response.status).toBe(400);
    expect(sendJoinApplicationEmail).not.toHaveBeenCalled();
  });
});
