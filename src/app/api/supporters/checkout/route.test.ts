import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/rate-limit")>();
  return { ...actual, enforceAuthRateLimit: vi.fn() };
});
vi.mock("@/lib/stripe", () => ({ createCheckoutSession: vi.fn(), stripeEnabled: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { POST } from "./route";

const session = { accessToken: "token", user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" } };

function request(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("http://localhost:3001/api/supporters/checkout", { method: "POST", headers: { Origin: "http://localhost:3001", "Content-Type": "application/x-www-form-urlencoded" }, body });
}

describe("POST /api/supporters/checkout", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3001";
    vi.mocked(stripeEnabled).mockReset().mockReturnValue(true);
    vi.mocked(getSession).mockReset().mockResolvedValue(session);
    vi.mocked(createCheckoutSession).mockReset().mockResolvedValue("https://checkout.stripe.test/session");
  });

  it("uses server-side monthly plan pricing", async () => {
    const response = await POST(request({ frequency: "monthly", tier: "premium", quantity: "99", consent: "accepted" }));
    expect(response.status).toBe(303);
    expect(createCheckoutSession).toHaveBeenCalledWith({ frequency: "monthly", amount: 1_500, tier: "premium", userId: "user-id", email: "member@example.com", quantity: 1 });
  });

  it("uses the 400 JPY Basic Supporter price", async () => {
    const response = await POST(request({ frequency: "monthly", tier: "basic", consent: "accepted" }));
    expect(response.status).toBe(303);
    expect(createCheckoutSession).toHaveBeenCalledWith({ frequency: "monthly", amount: 400, tier: "basic", userId: "user-id", email: "member@example.com", quantity: 1 });
  });

  it("rejects the removed one-time Standard plan", async () => {
    const response = await POST(request({ frequency: "one_time", tier: "standard", quantity: "13", consent: "accepted" }));
    expect(response.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("uses fixed server-side one-time Supporter pricing", async () => {
    const response = await POST(request({ frequency: "one_time", tier: "supporter", quantity: "2", consent: "accepted" }));
    expect(response.status).toBe(303);
    expect(createCheckoutSession).toHaveBeenCalledWith({ frequency: "one_time", amount: 300, tier: "supporter", userId: "user-id", email: "member@example.com", quantity: 1 });
  });

  it("requires login for one-time support", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const response = await POST(request({ frequency: "one_time", tier: "supporter", consent: "accepted" }));
    expect(response.status).toBe(401);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("requires explicit consent", async () => {
    const response = await POST(request({ frequency: "monthly", tier: "basic" }));
    expect(response.status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    const original = request({ frequency: "monthly", tier: "basic", consent: "accepted" });
    const crossOrigin = new Request(original, { headers: { ...Object.fromEntries(original.headers), Origin: "https://evil.example" } });
    const response = await POST(crossOrigin);
    expect(response.status).toBe(403);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
