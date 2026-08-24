import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/provider", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/provider";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { proxy } from "./proxy";

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost:3001${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : undefined,
  });
}

const member = {
  id: "member",
  displayName: "Member",
  isAdmin: false,
  tfaEnabled: false,
};

describe("route protection proxy", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
  });

  it("does not perform authentication for public pages", async () => {
    const response = await proxy(request("/about"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated protected request with a safe next path", async () => {
    const response = await proxy(request("/me?status=draft"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3001/login?next=%2Fme%3Fstatus%3Ddraft");
  });

  it("allows a valid member into member pages", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(member);
    const response = await proxy(request("/article/new", "valid-token"));

    expect(response.status).toBe(200);
    expect(getCurrentUser).toHaveBeenCalledWith("valid-token");
  });

  it("keeps a member out of administrator pages", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(member);
    const response = await proxy(request("/admin/about", "member-token"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3001/");
  });

  it("allows an administrator and clears an invalid session", async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ ...member, isAdmin: true });
    expect((await proxy(request("/admin/reviews", "admin-token"))).status).toBe(200);

    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error("expired"));
    const expired = await proxy(request("/me", "expired-token"));
    expect(expired.status).toBe(307);
    expect(expired.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=;`);
    expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
