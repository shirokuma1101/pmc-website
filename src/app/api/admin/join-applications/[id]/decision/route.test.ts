import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: vi.fn().mockResolvedValue({ accessToken: "token", user: { isAdmin: true } }) }));
vi.mock("@/lib/directus/join-applications", () => ({
  getJoinApplication: vi.fn().mockResolvedValue({ id: "7e06c851-552d-45e7-8d3e-a8f07636213c", displayName: "しろくま", email: "join@example.com", status: "pending" }),
  decideJoinApplication: vi.fn().mockResolvedValue({ id: "7e06c851-552d-45e7-8d3e-a8f07636213c", displayName: "しろくま", email: "join@example.com" }),
}));
vi.mock("@/lib/email/resend", () => ({ sendJoinDecisionEmail: vi.fn().mockResolvedValue("email-id") }));

import { decideJoinApplication } from "@/lib/directus/join-applications";
import { sendJoinDecisionEmail } from "@/lib/email/resend";
import { POST } from "./route";

const context = { params: Promise.resolve({ id: "7e06c851-552d-45e7-8d3e-a8f07636213c" }) };

describe("join application decision route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores the decision and sends the result email", async () => {
    const request = new Request("http://localhost:3001/api/admin/join-applications/id/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ status: "accepted", message: "ようこそ！" }),
    });
    const response = await POST(request, context);
    expect(response.status).toBe(200);
    expect(decideJoinApplication).toHaveBeenCalledWith(expect.any(String), "accepted", "ようこそ！", "token");
    expect(sendJoinDecisionEmail).toHaveBeenCalledWith(expect.objectContaining({ email: "join@example.com" }), "accepted", "ようこそ！", expect.any(String));
  });

  it("rejects unsupported decisions", async () => {
    const request = new Request("http://localhost:3001/api/admin/join-applications/id/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3001" },
      body: JSON.stringify({ status: "pending", message: "" }),
    });
    expect((await POST(request, context)).status).toBe(400);
    expect(decideJoinApplication).not.toHaveBeenCalled();
  });
});
