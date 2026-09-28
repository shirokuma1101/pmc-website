import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/article", () => ({ ArticleGrid: () => <div /> }));
vi.mock("@/components/profile", () => ({ ProfileForm: () => <div /> }));
vi.mock("@/components/timeline", () => ({ PostCard: () => <div /> }));
vi.mock("@/components/ui", () => ({ Avatar: () => <div />, EmptyState: () => <div /> }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/directus/articles", () => ({ getOwnArticles: vi.fn() }));
vi.mock("@/lib/directus/posts", () => ({ getPosts: vi.fn() }));
vi.mock("@/lib/directus/profiles", () => ({ getProfileByUserId: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripeEnabled: vi.fn() }));
vi.mock("@/lib/supporter-subscriptions", () => ({ findSupporterSubscriptionCustomer: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { getOwnArticles } from "@/lib/directus/articles";
import { getPosts } from "@/lib/directus/posts";
import { getProfileByUserId } from "@/lib/directus/profiles";
import { stripeEnabled } from "@/lib/stripe";
import { findSupporterSubscriptionCustomer } from "@/lib/supporter-subscriptions";
import MyPage from "./page";

const session = { accessToken: "token", user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" } };

describe("MyPage supporter management", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(getSession).mockReset().mockResolvedValue(session);
    vi.mocked(getProfileByUserId).mockReset().mockResolvedValue(null);
    vi.mocked(getOwnArticles).mockReset().mockResolvedValue({ data: [], pagination: { page: 1, limit: 50, hasMore: false } });
    vi.mocked(getPosts).mockReset().mockResolvedValue({ data: [], pagination: { page: 1, limit: 8, hasMore: false } });
    vi.mocked(stripeEnabled).mockReset().mockReturnValue(true);
    vi.mocked(findSupporterSubscriptionCustomer).mockReset().mockResolvedValue("cus_current");
  });

  it("shows the portal button on My Page for a monthly subscriber", async () => {
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    const button = screen.getByRole("button", { name: "支払い方法・月額契約を管理" });
    expect(button.closest("form")).toHaveAttribute("action", "/api/supporters/portal");
  });

  it("hides the portal button when no manageable monthly subscription exists", async () => {
    vi.mocked(findSupporterSubscriptionCustomer).mockResolvedValue(null);
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("button", { name: "支払い方法・月額契約を管理" })).not.toBeInTheDocument();
  });
});
