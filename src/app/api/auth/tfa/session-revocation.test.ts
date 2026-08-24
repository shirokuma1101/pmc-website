import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue(cookieStore) }));
vi.mock("@/lib/security/csrf", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/security/csrf")>(),
  assertSameOrigin: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
  clearSessionCookie: vi.fn(),
}));
vi.mock("@/lib/auth/provider", () => ({
  enableTwoFactor: vi.fn(),
  disableTwoFactor: vi.fn(),
  revokeAllSessions: vi.fn(),
}));
vi.mock("@/lib/auth/tfaSetup", () => ({
  readPendingTwoFactorSetup: vi.fn(),
  sealPendingTwoFactorSetup: vi.fn(),
}));

import { clearSessionCookie, requireSession } from "@/lib/auth/session";
import { disableTwoFactor, enableTwoFactor, revokeAllSessions } from "@/lib/auth/provider";
import { readPendingTwoFactorSetup } from "@/lib/auth/tfaSetup";
import { TFA_SETUP_COOKIE } from "@/lib/auth/cookies";
import { POST as enable } from "./enable/route";
import { POST as disable } from "./disable/route";

const session = {
  accessToken: "session-token",
  user: {
    id: "user-id",
    displayName: "Member",
    isAdmin: false,
    tfaEnabled: false,
  },
};

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("TOTP session revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockReturnValue({ value: "sealed-setup" });
    vi.mocked(revokeAllSessions).mockResolvedValue(undefined);
    vi.mocked(clearSessionCookie).mockResolvedValue(undefined);
  });

  it("revokes every Directus session and clears cookies after enabling TOTP", async () => {
    vi.mocked(requireSession).mockResolvedValue(session);
    vi.mocked(readPendingTwoFactorSetup).mockReturnValue({
      userId: "user-id",
      secret: "JBSWY3DPEHPK3PXP",
      expiresAt: Date.now() + 60_000,
      attemptsRemaining: 5,
    });
    vi.mocked(enableTwoFactor).mockResolvedValue(undefined);

    const response = await enable(jsonRequest("/api/auth/tfa/enable", { otp: "012345" }));

    expect(response.status).toBe(204);
    expect(enableTwoFactor).toHaveBeenCalledWith("session-token", "JBSWY3DPEHPK3PXP", "012345");
    expect(revokeAllSessions).toHaveBeenCalledWith("session-token");
    expect(clearSessionCookie).toHaveBeenCalledOnce();
    expect(cookieStore.set).toHaveBeenCalledWith(
      TFA_SETUP_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("revokes every Directus session and clears the session cookie after disabling TOTP", async () => {
    vi.mocked(requireSession).mockResolvedValue({
      ...session,
      user: { ...session.user, tfaEnabled: true },
    });
    vi.mocked(disableTwoFactor).mockResolvedValue(undefined);

    const response = await disable(jsonRequest("/api/auth/tfa/disable", {
      password: "current-password",
      otp: "012345",
    }));

    expect(response.status).toBe(204);
    expect(disableTwoFactor).toHaveBeenCalledWith("session-token", "current-password", "012345");
    expect(revokeAllSessions).toHaveBeenCalledWith("session-token");
    expect(clearSessionCookie).toHaveBeenCalledOnce();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
