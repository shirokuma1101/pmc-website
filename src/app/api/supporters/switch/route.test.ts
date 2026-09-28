import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/security/rate-limit", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/security/rate-limit")>(), enforceAuthRateLimit: vi.fn() }));
vi.mock("@/lib/stripe", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/stripe")>(), createCheckoutSession: vi.fn(), stripeEnabled: vi.fn() }));
vi.mock("@/lib/supporter-subscriptions", () => ({ findSwitchableSubscription: vi.fn() }));

import { requireSession } from "@/lib/auth/session";
import { createCheckoutSession, stripeEnabled, StripeApiError } from "@/lib/stripe";
import { findSwitchableSubscription } from "@/lib/supporter-subscriptions";
import { POST } from "./route";

const session = { accessToken: "token", user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" } };
const source = { id: "sub_old", customer: "cus_old", status: "active", cancel_at_period_end: false, metadata: { tier: "basic", user_id: "user-id" }, tier: "basic" } as const;

function request(fields: Record<string, string>) {
  return new Request("http://localhost:3001/api/supporters/switch", {
    method: "POST",
    headers: { Origin: "http://localhost:3001", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tier: "standard", consent: "accepted", adultConfirmed: "accepted", ...fields }),
  });
}

describe("POST /api/supporters/switch", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3001";
    vi.mocked(requireSession).mockReset().mockResolvedValue(session);
    vi.mocked(stripeEnabled).mockReset().mockReturnValue(true);
    vi.mocked(findSwitchableSubscription).mockReset().mockResolvedValue(source);
    vi.mocked(createCheckoutSession).mockReset().mockResolvedValue("https://checkout.stripe.test/switch");
  });

  it("creates a new paid plan checkout bound to the old subscription", async () => {
    expect((await POST(request({}))).status).toBe(303);
    expect(createCheckoutSession).toHaveBeenCalledWith({ frequency: "monthly", tier: "standard", amount: 800, userId: "user-id", customer: "cus_old", switchFromSubscription: "sub_old", quantity: 1 });
  });

  it("rejects switching to the same plan", async () => {
    expect((await POST(request({ tier: "basic" }))).status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects unavailable or ambiguous subscriptions", async () => {
    vi.mocked(findSwitchableSubscription).mockResolvedValue(null);
    expect((await POST(request({}))).status).toBe(409);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("requires adult confirmation", async () => {
    expect((await POST(request({ adultConfirmed: "" }))).status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("does not create a second Checkout for a different target while a switch is in progress", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValue(new StripeApiError("Different parameters", "idempotency_error"));
    expect((await POST(request({ tier: "premium" }))).status).toBe(409);
  });
});
