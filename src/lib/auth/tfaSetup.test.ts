import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { TFA_SETUP_TTL_SECONDS } from "./cookies";
import {
  createPendingTwoFactorSetup,
  readPendingTwoFactorSetup,
  sealPendingTwoFactorSetup,
} from "./tfaSetup";

const NOW = new Date("2026-08-21T03:00:00.000Z");
const USER_ID = "1c304507-4dbf-4d6c-8b15-5e32eab8eb70";
const OTHER_USER_ID = "f3e5f055-8fa6-4f9d-b16a-d7714154bb81";
const SESSION_TOKEN = "session-token-for-user";
const SECRET = "JBSWY3DPEHPK3PXP";

describe("pending two-factor setup state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips an encrypted setup state for the same user and session", () => {
    const token = createPendingTwoFactorSetup(USER_ID, SECRET, SESSION_TOKEN);

    expect(token).not.toContain(USER_ID);
    expect(token).not.toContain(SECRET);
    expect(readPendingTwoFactorSetup(token, SESSION_TOKEN, USER_ID)).toEqual({
      userId: USER_ID,
      secret: SECRET,
      expiresAt: NOW.getTime() + TFA_SETUP_TTL_SECONDS * 1_000,
      attemptsRemaining: 5,
    });
  });

  it("cannot be opened with another session or for another user", () => {
    const token = createPendingTwoFactorSetup(USER_ID, SECRET, SESSION_TOKEN);

    expect(readPendingTwoFactorSetup(token, "another-session-token", USER_ID)).toBeNull();
    expect(readPendingTwoFactorSetup(token, SESSION_TOKEN, OTHER_USER_ID)).toBeNull();
  });

  it("rejects a tampered ciphertext", () => {
    const token = createPendingTwoFactorSetup(USER_ID, SECRET, SESSION_TOKEN);
    const parts = token.split(".");
    const ciphertext = parts[1] as string;
    const index = Math.floor(ciphertext.length / 2);
    parts[1] = `${ciphertext.slice(0, index)}${ciphertext[index] === "A" ? "B" : "A"}${ciphertext.slice(index + 1)}`;

    expect(readPendingTwoFactorSetup(parts.join("."), SESSION_TOKEN, USER_ID)).toBeNull();
  });

  it("rejects an expired setup state", () => {
    const token = sealPendingTwoFactorSetup({
      userId: USER_ID,
      secret: SECRET,
      expiresAt: NOW.getTime() - 1,
      attemptsRemaining: 5,
    }, SESSION_TOKEN);

    expect(readPendingTwoFactorSetup(token, SESSION_TOKEN, USER_ID)).toBeNull();
  });

  it("rejects a setup state with no attempts remaining", () => {
    const token = sealPendingTwoFactorSetup({
      userId: USER_ID,
      secret: SECRET,
      expiresAt: NOW.getTime() + TFA_SETUP_TTL_SECONDS * 1_000,
      attemptsRemaining: 0,
    }, SESSION_TOKEN);

    expect(readPendingTwoFactorSetup(token, SESSION_TOKEN, USER_ID)).toBeNull();
  });
});
