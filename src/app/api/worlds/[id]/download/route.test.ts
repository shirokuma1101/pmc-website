import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return { ...actual, requireSession: vi.fn() };
});
vi.mock("@/lib/directus/worlds", () => ({ downloadWorld: vi.fn() }));

import { AuthRequiredError, requireSession } from "@/lib/auth/session";
import { downloadWorld } from "@/lib/directus/worlds";
import { GET } from "./route";

const fileId = "123e4567-e89b-42d3-a456-426614174000";

describe("GET /api/worlds/:id/download", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockReset().mockResolvedValue({
      accessToken: "token",
      user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" },
    });
    vi.mocked(downloadWorld).mockReset().mockResolvedValue(new Response("world", {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=world.zip",
      },
    }));
  });

  it("proxies downloads only after authenticating the session", async () => {
    const response = await GET(new Request(`http://localhost/api/worlds/${fileId}/download`), {
      params: Promise.resolve({ id: fileId }),
    });
    expect(response.status).toBe(200);
    expect(requireSession).toHaveBeenCalledOnce();
    expect(downloadWorld).toHaveBeenCalledWith(fileId, "token");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("world");
  });

  it("does not contact Directus for an unauthenticated request", async () => {
    vi.mocked(requireSession).mockRejectedValue(new AuthRequiredError());
    const response = await GET(new Request(`http://localhost/api/worlds/${fileId}/download`), {
      params: Promise.resolve({ id: fileId }),
    });
    expect(response.status).toBe(401);
    expect(downloadWorld).not.toHaveBeenCalled();
  });
});
