import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { turnstileProtectedInputFrom, verifyTurnstile } from "./turnstile";

const request = new Request("https://pmc.example.com/api/auth/login", { method: "POST" });

describe("Turnstile verification", () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("accepts a successful token with the expected action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true,
      action: "login",
    }), { status: 200 }));
    await expect(verifyTurnstile(request, "XXXX.DUMMY.TOKEN.XXXX", "login")).resolves.toBeUndefined();
  });

  it("accepts the official always-pass test response without an action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true,
      hostname: "example.com",
      metadata: { result_with_testing_key: true },
    }), { status: 200 }));
    await expect(verifyTurnstile(request, "XXXX.DUMMY.TOKEN.XXXX", "login")).resolves.toBeUndefined();
  });

  it("requires an action when a production secret is configured", async () => {
    process.env.TURNSTILE_SECRET_KEY = "production-secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    await expect(verifyTurnstile(request, "token", "login")).rejects.toMatchObject({ code: "TURNSTILE_FAILED" });
  });

  it("separates the Turnstile token without weakening strict input validation", () => {
    expect(turnstileProtectedInputFrom({ email: "member@example.com", turnstileToken: "token" }))
      .toEqual({ email: "member@example.com" });
  });

  it.each([
    [{ success: false, "error-codes": ["invalid-input-response"] }, "invalid token"],
    [{ success: false, "error-codes": ["timeout-or-duplicate"] }, "expired or reused token"],
    [{ success: true, action: "registration" }, "wrong action"],
  ])("rejects %s (%s)", async (result, _description) => {
    expect(_description).toBeTruthy();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }));
    await expect(verifyTurnstile(request, "token", "login")).rejects.toMatchObject({ code: "TURNSTILE_FAILED" });
  });

  it("fails closed when Siteverify is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));
    await expect(verifyTurnstile(request, "token", "login")).rejects.toMatchObject({ code: "TURNSTILE_FAILED" });
  });

  it("rejects a missing token without contacting Cloudflare", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(verifyTurnstile(request, undefined, "login")).rejects.toMatchObject({ code: "TURNSTILE_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
