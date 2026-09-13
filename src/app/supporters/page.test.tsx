import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/support", () => ({ SupportForm: () => <div>Support form</div> }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/directus/client", () => ({ directusRequest: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ hasManageableStripeSubscription: vi.fn(), stripeEnabled: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { directusRequest } from "@/lib/directus/client";
import { hasManageableStripeSubscription, stripeEnabled } from "@/lib/stripe";
import SupportPage from "./page";

const session = { accessToken: "token", user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" } };

describe("SupportPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(getSession).mockReset().mockResolvedValue(session);
    vi.mocked(stripeEnabled).mockReset().mockReturnValue(true);
    vi.mocked(directusRequest).mockReset().mockResolvedValue({ data: { customer: "cus_current" } });
    vi.mocked(hasManageableStripeSubscription).mockReset().mockResolvedValue(true);
  });

  it("shows the portal button for a manageable monthly subscription", async () => {
    render(await SupportPage());
    expect(screen.getByRole("button", { name: "支払い方法・月額プランを管理" })).toBeInTheDocument();
  });

  it("hides the portal button when the current Stripe environment has no manageable subscription", async () => {
    vi.mocked(hasManageableStripeSubscription).mockResolvedValue(false);
    render(await SupportPage());
    expect(screen.queryByRole("button", { name: "支払い方法・月額プランを管理" })).not.toBeInTheDocument();
  });
});
