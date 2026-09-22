import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/directus/client", () => ({ directusRequest: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ hasManageableStripeSubscription: vi.fn(), hasOpenStripeSubscription: vi.fn() }));
import { directusRequest } from "@/lib/directus/client";
import { hasManageableStripeSubscription, hasOpenStripeSubscription } from "@/lib/stripe";
import { findSupporterSubscriptionCustomer } from "./supporter-subscriptions";

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
});
