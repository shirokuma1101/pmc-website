import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/directus/client", () => ({ directusRequest: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ hasManageableStripeSubscription: vi.fn(), hasOpenStripeSubscription: vi.fn(), listOpenStripeSubscriptions: vi.fn() }));
import { directusRequest } from "@/lib/directus/client";
import { hasManageableStripeSubscription, hasOpenStripeSubscription, listOpenStripeSubscriptions } from "@/lib/stripe";
import { findSupporterSubscriptionCustomer, findSwitchableSubscription } from "./supporter-subscriptions";

describe("supporter customer lookup", () => {
  beforeEach(() => vi.resetAllMocks());
  it("finds an older active customer when the latest customer is canceled or in another sandbox", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { customer: "cus_new", customers: ["cus_new", "cus_old"] } });
    vi.mocked(hasManageableStripeSubscription).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await findSupporterSubscriptionCustomer("user")).toBe("cus_old");
  });
  it("uses the stricter check for checkout and propagates provider outages", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { customer: "cus_test", customers: ["cus_test"] } });
    vi.mocked(hasOpenStripeSubscription).mockRejectedValue(new Error("unavailable"));
    await expect(findSupporterSubscriptionCustomer("user", true)).rejects.toThrow("unavailable");
  });
  it("allows switching only when one active owned subscription exists", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { customer: "cus_old", customers: ["cus_old"] } });
    vi.mocked(listOpenStripeSubscriptions).mockResolvedValue([{ id: "sub_old", customer: "cus_old", status: "active", cancel_at_period_end: false, metadata: { user_id: "user", tier: "basic" } }]);
    expect((await findSwitchableSubscription("user"))?.tier).toBe("basic");
    vi.mocked(listOpenStripeSubscriptions).mockResolvedValue([{ id: "sub_old", customer: "cus_old", status: "active", cancel_at_period_end: true, metadata: { user_id: "user", tier: "basic" } }]);
    expect(await findSwitchableSubscription("user")).toBeNull();
  });
  it("uses the new plan when the previous plan is active but scheduled to end", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { customer: "cus_same", customers: ["cus_same"] } });
    vi.mocked(listOpenStripeSubscriptions).mockResolvedValue([
      { id: "sub_standard", customer: "cus_same", status: "active", cancel_at_period_end: true, metadata: { user_id: "user", tier: "standard" } },
      { id: "sub_premium", customer: "cus_same", status: "active", cancel_at_period_end: false, metadata: { user_id: "user", tier: "premium" } },
    ]);
    expect((await findSwitchableSubscription("user"))?.id).toBe("sub_premium");
  });
  it("still blocks switching when two subscriptions could renew", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { customer: "cus_same", customers: ["cus_same"] } });
    vi.mocked(listOpenStripeSubscriptions).mockResolvedValue([
      { id: "sub_standard", customer: "cus_same", status: "active", cancel_at_period_end: false, metadata: { user_id: "user", tier: "standard" } },
      { id: "sub_premium", customer: "cus_same", status: "active", cancel_at_period_end: false, metadata: { user_id: "user", tier: "premium" } },
    ]);
    expect(await findSwitchableSubscription("user")).toBeNull();
  });
});
