import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/support", () => ({ SupportForm: () => <div>Support form</div> }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/directus/client", () => ({ directusRequest: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ hasManageableStripeSubscription: vi.fn(), stripeEnabled: vi.fn() }));
vi.mock("@/lib/supporter-subscriptions", () => ({ findSupporterSubscriptionCustomer: vi.fn(), findSwitchableSubscription: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { directusRequest } from "@/lib/directus/client";
import { hasManageableStripeSubscription, stripeEnabled } from "@/lib/stripe";
import { findSupporterSubscriptionCustomer, findSwitchableSubscription } from "@/lib/supporter-subscriptions";
import SupportPage from "./page";

const session = { accessToken: "token", user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" } };

describe("SupportPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(getSession).mockReset().mockResolvedValue(session);
    vi.mocked(stripeEnabled).mockReset().mockReturnValue(true);
    vi.mocked(directusRequest).mockReset().mockResolvedValue({ data: { customer: "cus_current" } });
    vi.mocked(hasManageableStripeSubscription).mockReset().mockResolvedValue(true);
    vi.mocked(findSupporterSubscriptionCustomer).mockReset().mockResolvedValue("cus_current");
    vi.mocked(findSwitchableSubscription).mockReset().mockResolvedValue({ id: "sub_current", customer: "cus_current", status: "active", cancel_at_period_end: false, metadata: { tier: "basic", user_id: "user-id" }, tier: "basic" });
  });

  it("keeps the portal button off the supporter application page", async () => {
    render(await SupportPage());
    expect(screen.queryByRole("button", { name: "支払い方法・月額契約を管理" })).not.toBeInTheDocument();
  });

  it("hides the portal button when the current Stripe environment has no manageable subscription", async () => {
    vi.mocked(hasManageableStripeSubscription).mockResolvedValue(false);
    vi.mocked(findSupporterSubscriptionCustomer).mockResolvedValue(null);
    render(await SupportPage());
    expect(screen.queryByRole("button", { name: "支払い方法・月額契約を管理" })).not.toBeInTheDocument();
  });

  it("shows usage and policy details before the plan selector", async () => {
    render(await SupportPage());
    const sectionHeadings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(sectionHeadings).toEqual(["会費・ご支援の主な用途", "お申し込み前にご確認ください", "支援方法を選ぶ"]);
    expect(screen.getByRole("link", { name: "特定商取引法に基づく表記" })).toHaveAttribute("href", "/commercial-transactions");
  });
});
