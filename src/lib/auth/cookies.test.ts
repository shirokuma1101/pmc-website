import { describe, expect, it } from "vitest";
import { baseCookieOptions, sessionCookieOptions, tfaSetupCookieOptions } from "./cookies";

describe("authentication cookie contract", () => {
  it("keeps the session token HttpOnly and same-site scoped", () => {
    expect(baseCookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("converts Directus expiry milliseconds to a positive max age", () => {
    expect(sessionCookieOptions({ session_token: "secret", expires: 90_999 }).maxAge).toBe(90);
    expect(sessionCookieOptions({ session_token: "secret", expires: 0 }).maxAge).toBe(1);
  });

  it("restricts temporary TOTP state to the TOTP API path", () => {
    expect(tfaSetupCookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/api/auth/tfa",
      maxAge: 600,
    });
  });
});
