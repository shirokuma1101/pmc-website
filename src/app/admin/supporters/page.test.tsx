import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/directus/organization", () => ({ getOrganization: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { getOrganization } from "@/lib/directus/organization";
import AdminSupportersPage from "./page";

const session = { accessToken: "token", user: { id: "admin", displayName: "Admin", isAdmin: true, tfaEnabled: false } };
const member = (name: string, tier?: "supporter" | "basic" | "standard" | "premium") => ({
  profileId: name,
  displayName: name,
  bio: "",
  role: "team_member" as const,
  roleLabel: "チームメンバー",
  team: "",
  highlighted: Boolean(tier),
  ...(tier ? { supporterTier: tier } : {}),
});

describe("AdminSupportersPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(session);
    vi.mocked(getOrganization).mockResolvedValue([
      member("Basic member", "basic"),
      member("Standard member", "standard"),
      member("Premium member", "premium"),
      member("One-time member", "supporter"),
    ]);
  });

  it("shows the desired Discord role for each active monthly supporter", async () => {
    render(await AdminSupportersPage());
    expect(screen.getByRole("heading", { name: "サポーター運用" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Basic member" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Standard member" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Premium member" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "One-time member" })).not.toBeInTheDocument();
    expect(screen.getAllByText("1人")).toHaveLength(3);
  });
});
