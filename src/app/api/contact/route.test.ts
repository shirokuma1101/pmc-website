import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/csrf", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/security/csrf")>(), assertSameOrigin: vi.fn() }));
vi.mock("@/lib/security/rate-limit", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/security/rate-limit")>(), enforceAuthRateLimit: vi.fn() }));
vi.mock("@/lib/security/turnstile", () => ({
  turnstileProtectedInputFrom: (body: Record<string, unknown>) => { const input = { ...body }; delete input.turnstileToken; return input; },
  turnstileTokenFrom: (body: Record<string, unknown>) => body.turnstileToken,
  verifyTurnstile: vi.fn(),
}));
vi.mock("@/lib/email/resend", () => ({ sendContactInquiryEmail: vi.fn() }));

import { sendContactInquiryEmail } from "@/lib/email/resend";
import { POST } from "./route";

const validBody = {
  submissionId: "7e06c851-552d-45e7-8d3e-a8f07636213c",
  recipientId: "support",
  category: "supporter",
  displayName: "Tester",
  email: "user@example.com",
  subject: "支払いについて",
  message: "支払いについて確認したいです。",
  policyConsent: true,
  turnstileToken: "test-token",
};

function request(body: unknown) {
  return new Request("http://localhost:3001/api/contact", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" }, body: JSON.stringify(body) });
}

describe("POST /api/contact", () => {
  beforeEach(() => { vi.mocked(sendContactInquiryEmail).mockReset().mockResolvedValue("email-id"); delete process.env.CONTACT_PERSONAL_RECIPIENTS; });

  it("sends a validated inquiry to the fixed common mailbox", async () => {
    expect((await POST(request(validBody))).status).toBe(201);
    expect(sendContactInquiryEmail).toHaveBeenCalledWith(expect.objectContaining({ email: "user@example.com" }), "support@postmineclan.com");
  });

  it("rejects an unconfigured personal recipient", async () => {
    expect((await POST(request({ ...validBody, recipientId: "unknown" }))).status).toBe(400);
    expect(sendContactInquiryEmail).not.toHaveBeenCalled();
  });

  it("rejects missing consent", async () => {
    expect((await POST(request({ ...validBody, policyConsent: false }))).status).toBe(400);
    expect(sendContactInquiryEmail).not.toHaveBeenCalled();
  });
});
