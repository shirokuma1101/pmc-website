import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/directus/client", () => ({ directusRequest: vi.fn() }));
vi.mock("@/lib/security/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/rate-limit")>();
  return { ...actual, enforceAuthRateLimit: vi.fn() };
});
vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return { ...actual, createCustomerPortalSession: vi.fn(), hasManageableStripeSubscription: vi.fn() };
});

import { requireSession } from "@/lib/auth/session";
import { directusRequest } from "@/lib/directus/client";
import { createCustomerPortalSession, hasManageableStripeSubscription, StripeApiError } from "@/lib/stripe";
import { POST } from "./route";

const session = { accessToken: "token", user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" } };

function request(): Request {
  return new Request("http://localhost:3001/api/supporters/portal", { method: "POST", headers: { Origin: "http://localhost:3001" } });
}

describe("POST /api/supporters/portal", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3001";
    vi.mocked(requireSession).mockReset().mockResolvedValue(session);
    vi.mocked(directusRequest).mockReset().mockResolvedValue({ data: { customer: "cus_current" } });
    vi.mocked(hasManageableStripeSubscription).mockReset().mockResolvedValue(true);
    vi.mocked(createCustomerPortalSession).mockReset().mockResolvedValue("https://billing.stripe.test/session");
  });

  it("redirects to a Customer Portal session", async () => {
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://billing.stripe.test/session");
  });

  it("reports a stale customer from another Stripe environment as missing", async () => {
    vi.mocked(hasManageableStripeSubscription).mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SUBSCRIPTION_NOT_FOUND",
        message: "現在のStripe環境に有効な月額サポーター契約が見つかりません。",
      },
    });
    expect(createCustomerPortalSession).not.toHaveBeenCalled();
  });

  it("handles a customer removed between validation and portal creation", async () => {
    vi.mocked(createCustomerPortalSession).mockRejectedValue(new StripeApiError("No such customer", "resource_missing"));
    const response = await POST(request());
    expect(response.status).toBe(404);
  });
});
