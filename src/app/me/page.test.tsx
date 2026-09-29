import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/article", () => ({ ArticleGrid: () => <div /> }));
vi.mock("@/components/markdown", () => ({ MarkdownContent: ({ children }: { children: string }) => <div>{children}</div> }));
vi.mock("@/components/profile", () => ({ ProfileForm: () => <div /> }));
vi.mock("@/components/timeline", () => ({ PostCard: () => <div /> }));
vi.mock("@/components/ui", () => ({ Avatar: () => <div />, EmptyState: () => <div /> }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/directus/articles", () => ({ getOwnArticles: vi.fn() }));
vi.mock("@/lib/directus/organization", () => ({ getOrganization: vi.fn(), getMyOneTimeSupportCount: vi.fn() }));
vi.mock("@/lib/directus/posts", () => ({ getPosts: vi.fn() }));
vi.mock("@/lib/directus/profiles", () => ({ getProfileByUserId: vi.fn() }));
vi.mock("@/lib/directus/worlds", () => ({ getWorldsPage: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripeEnabled: vi.fn() }));
vi.mock("@/lib/supporter-subscriptions", () => ({ findSupporterSubscriptionCustomer: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { getOwnArticles } from "@/lib/directus/articles";
import { getMyOneTimeSupportCount, getOrganization } from "@/lib/directus/organization";
import { getPosts } from "@/lib/directus/posts";
import { getProfileByUserId } from "@/lib/directus/profiles";
import { getWorldsPage } from "@/lib/directus/worlds";
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
    vi.mocked(getOrganization).mockReset().mockResolvedValue([]);
    vi.mocked(getMyOneTimeSupportCount).mockReset().mockResolvedValue(4);
    vi.mocked(getPosts).mockReset().mockResolvedValue({ data: [], pagination: { page: 1, limit: 8, hasMore: false } });
    vi.mocked(stripeEnabled).mockReset().mockReturnValue(true);
    vi.mocked(findSupporterSubscriptionCustomer).mockReset().mockResolvedValue("cus_current");
    vi.mocked(getWorldsPage).mockReset().mockResolvedValue({ content: { markdown: "過去ワールドの説明" }, files: [{ id: "world-1", filename: "world.zip", description: "テストワールド", uploadedAt: "" }] });
  });

  it("shows the portal button on My Page for a monthly subscriber", async () => {
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    const button = screen.getByRole("button", { name: "支払い方法・月額契約を管理" });
    expect(button.closest("form")).toHaveAttribute("action", "/api/supporters/portal");
  });

  it("shows a one-time badge only when its profile visibility setting allows it", async () => {
    vi.mocked(getOrganization).mockResolvedValue([{ userId: session.user.id, supporterTier: "supporter", supporterBadgeLevel: 2 }] as never);
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("Supporter II")).toBeInTheDocument();
    cleanup();
    vi.mocked(getProfileByUserId).mockResolvedValue({ id: "profile-id", displayName: "Member", bio: "", supporterBadgeVisible: false });
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByText("Supporter II")).not.toBeInTheDocument();
  });

  it("shows the exact one-time support count only on My Page", async () => {
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("単発サポートの累計：4回（本人のみ表示）")).toBeInTheDocument();
    expect(getMyOneTimeSupportCount).toHaveBeenCalledWith("token");
  });

  it("hides the portal button when no manageable monthly subscription exists", async () => {
    vi.mocked(findSupporterSubscriptionCustomer).mockResolvedValue(null);
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("button", { name: "支払い方法・月額契約を管理" })).not.toBeInTheDocument();
  });

  it("shows activity in its tab and preserves the tab when filtering articles", async () => {
    render(await MyPage({ searchParams: Promise.resolve({ tab: "activity" }) }));
    expect(screen.getByRole("link", { name: "記事・Postの状態" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "マイページの項目" })).toContainElement(screen.getByRole("button", { name: "支払い方法・月額契約を管理" }));
    expect(screen.getByRole("link", { name: "下書き" })).toHaveAttribute("href", "/me?tab=activity&status=draft");
    expect(screen.queryByRole("heading", { name: "プロフィール編集" })).not.toBeInTheDocument();
  });

  it("shows available world downloads in the worlds tab", async () => {
    render(await MyPage({ searchParams: Promise.resolve({ tab: "worlds" }) }));
    expect(screen.getByRole("link", { name: "ワールドダウンロード" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("world.zip")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ダウンロード" })).toHaveAttribute("href", "/api/worlds/world-1/download");
  });

  it("opens and closes the compact page menu", async () => {
    render(await MyPage({ searchParams: Promise.resolve({}) }));
    const toggle = screen.getByRole("button", { name: "マイページのメニュー" });
    const navigation = screen.getByRole("navigation", { name: "マイページの項目" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(navigation).toHaveAttribute("data-open", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(navigation).toHaveAttribute("data-open", "true");
    fireEvent.click(toggle);
    expect(navigation).toHaveAttribute("data-open", "false");
  });
});
