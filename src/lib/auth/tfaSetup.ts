import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { TFA_SETUP_TTL_SECONDS } from "./cookies";

const CONTEXT = "pmc-website:tfa-setup:v1";

export interface PendingTwoFactorSetup {
  userId: string;
  secret: string;
  expiresAt: number;
  attemptsRemaining: number;
}

function encryptionKey(sessionToken: string): Buffer {
  return createHash("sha256")
    .update(CONTEXT)
    .update("\0")
    .update(sessionToken)
    .digest();
}

export function createPendingTwoFactorSetup(
  userId: string,
  secret: string,
  sessionToken: string,
): string {
  const state: PendingTwoFactorSetup = {
    userId,
    secret,
    expiresAt: Date.now() + TFA_SETUP_TTL_SECONDS * 1_000,
    attemptsRemaining: 5,
  };
  return sealPendingTwoFactorSetup(state, sessionToken);
}

export function sealPendingTwoFactorSetup(
  state: PendingTwoFactorSetup,
  sessionToken: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(sessionToken), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ v: 1, ...state }), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((part) => part.toString("base64url")).join(".");
}

export function readPendingTwoFactorSetup(
  token: string | undefined,
  sessionToken: string,
  expectedUserId: string,
): PendingTwoFactorSetup | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [ivPart, ciphertextPart, tagPart] = parts;
    if (!ivPart || !ciphertextPart || !tagPart) return null;
    const iv = Buffer.from(ivPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(sessionToken), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== "object") return null;
    const state = parsed as Partial<PendingTwoFactorSetup> & { v?: unknown };
    if (
      state.v !== 1
      || state.userId !== expectedUserId
      || typeof state.secret !== "string"
      || !Number.isSafeInteger(state.expiresAt)
      || !Number.isSafeInteger(state.attemptsRemaining)
      || (state.expiresAt ?? 0) <= Date.now()
      || (state.attemptsRemaining ?? 0) <= 0
    ) return null;
    return {
      userId: state.userId,
      secret: state.secret,
      expiresAt: state.expiresAt as number,
      attemptsRemaining: state.attemptsRemaining as number,
    };
  } catch {
    return null;
  }
}
