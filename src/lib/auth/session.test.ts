import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue(cookieStore) }));
vi.mock("@/lib/auth/provider", () => ({ getCurrentUser: vi.fn() }));

import { SESSION_COOKIE } from "./cookies";
import { clearSessionCookie, getSessionToken, setSessionCookie } from "./session";

describe("BFF session cookie lifecycle", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
  });

  it("issues an HttpOnly session cookie using the Directus expiry", async () => {
    await setSessionCookie({ session_token: "session-secret", expires: 120_000 });

    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "session-secret",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 120,
      }),
    );
  });

  it("reads and expires the same cookie name", async () => {
    cookieStore.get.mockReturnValue({ value: "stored-token" });
    await expect(getSessionToken()).resolves.toBe("stored-token");

    await clearSessionCookie();
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "",
      expect.objectContaining({ httpOnly: true, path: "/", maxAge: 0 }),
    );
  });
});
