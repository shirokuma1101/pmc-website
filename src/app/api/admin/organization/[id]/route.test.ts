import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAdminSession: vi.fn() }));
vi.mock("@/lib/directus/organization", () => ({
  deleteOrganizationMember: vi.fn(),
  updateOrganizationMember: vi.fn(),
}));

import { requireAdminSession } from "@/lib/auth/session";
import { deleteOrganizationMember } from "@/lib/directus/organization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { DELETE } from "./route";

describe("DELETE /api/admin/organization/[id]", () => {
  beforeEach(() => {
    vi.mocked(assertSameOrigin).mockReset();
    vi.mocked(requireAdminSession).mockReset().mockResolvedValue({
      accessToken: "admin-token",
      user: { id: "admin", displayName: "Admin", isAdmin: true, tfaEnabled: false },
    });
    vi.mocked(deleteOrganizationMember).mockReset().mockResolvedValue(undefined);
  });

  it("deletes the public member through the authenticated provider", async () => {
    const request = new Request("http://localhost:3001/api/admin/organization/profile%2Fid", {
      method: "DELETE",
      headers: { Origin: "http://localhost:3001" },
    });
    const context = { params: Promise.resolve({ id: "profile/id" }) } as RouteContext<"/api/admin/organization/[id]">;

    const response = await DELETE(request, context);

    expect(response.status).toBe(204);
    expect(assertSameOrigin).toHaveBeenCalledWith(request);
    expect(requireAdminSession).toHaveBeenCalledOnce();
    expect(deleteOrganizationMember).toHaveBeenCalledWith("profile/id", "admin-token");
  });
});
