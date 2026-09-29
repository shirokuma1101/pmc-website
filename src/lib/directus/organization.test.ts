import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({ directusAssetUrl: vi.fn() }));
vi.mock("@/lib/directus/client", () => ({ directusRequest: vi.fn() }));

import { directusRequest } from "@/lib/directus/client";
import { createOrganizationMember, deleteOrganizationMember, getMyOneTimeSupportCount, getOrganization, updateOrganizationMember } from "./organization";

const memberInput = {
  displayName: "公開メンバー",
  bio: "公開側の紹介文",
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: "team_member" as const,
  team: "建築チーム",
  parentId: null,
  xboxGamertag: "MemberXbox",
  groupId: null,
};

describe("deleteOrganizationMember", () => {
  beforeEach(() => {
    vi.mocked(directusRequest).mockReset().mockResolvedValue(undefined);
  });

  it("deletes the member profile through the dedicated endpoint", async () => {
    await deleteOrganizationMember("profile/id", "admin-token");

    expect(directusRequest).toHaveBeenCalledWith(
      "/pmc-website/organization/profile%2Fid",
      { method: "DELETE", accessToken: "admin-token" },
    );
  });
});

describe("getOrganization", () => {
  it("maps the public badge level without requiring the exact payment count", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: [{ profile_id: "member-id", display_name: "Member", role: "team_member", supporterTier: "supporter", supporterBadgeLevel: 3 }] });
    await expect(getOrganization()).resolves.toMatchObject([{ supporterTier: "supporter", supporterBadgeLevel: 3 }]);
  });

  it("omits a badge level when the public supporter tier is hidden", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: [{ profile_id: "member-id", display_name: "Member", role: "team_member", supporterTier: null, supporterBadgeLevel: null }] });
    await expect(getOrganization()).resolves.toMatchObject([{ highlighted: false }]);
    expect((await getOrganization())[0]).not.toHaveProperty("supporterBadgeLevel");
  });
});

describe("getMyOneTimeSupportCount", () => {
  it("requests the private count with the current user's access token", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { count: 15 } });
    await expect(getMyOneTimeSupportCount("own-token")).resolves.toBe(15);
    expect(directusRequest).toHaveBeenCalledWith("/pmc-website/my-one-time-support", { accessToken: "own-token" });
  });
});

describe("organization member profile synchronization", () => {
  beforeEach(() => {
    vi.mocked(directusRequest).mockReset();
  });

  it("returns the account bio selected by Directus when creating a linked member", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { id: "member-id", bio: "アカウントの紹介文" } });

    await expect(createOrganizationMember(memberInput, "admin-token")).resolves.toEqual({ id: "member-id", displayName: "公開メンバー", bio: "アカウントの紹介文", xboxGamertag: "MemberXbox" });
  });

  it("returns the account bio selected by Directus when updating a linked member", async () => {
    vi.mocked(directusRequest).mockResolvedValue({ data: { id: "member-id", bio: "更新後のアカウント紹介文" } });

    await expect(updateOrganizationMember("member-id", memberInput, "admin-token")).resolves.toEqual({ id: "member-id", displayName: "公開メンバー", bio: "更新後のアカウント紹介文", xboxGamertag: "MemberXbox" });
  });
});
