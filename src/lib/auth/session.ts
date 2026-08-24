import "server-only";

import { cookies } from "next/headers";
import type { DirectusSessionData } from "@/types/directus";
import type { ServerSession } from "@/types";
import { DirectusError } from "@/lib/directus/client";
import {
  SESSION_COOKIE,
  baseCookieOptions,
  sessionCookieOptions,
} from "./cookies";
import { getCurrentUser } from "./provider";

export class AuthRequiredError extends Error {
  readonly code: string;

  constructor(
    message = "Authentication is required",
    public readonly status = 401,
    code = "AUTH_REQUIRED",
  ) {
    super(message);
    this.name = "AuthRequiredError";
    this.code = code;
  }
}

export async function setSessionCookie(tokens: DirectusSessionData): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, tokens.session_token, sessionCookieOptions(tokens));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function getSession(): Promise<ServerSession | null> {
  const accessToken = await getSessionToken();
  if (!accessToken) return null;
  try {
    return { user: await getCurrentUser(accessToken), accessToken };
  } catch (error) {
    if (error instanceof DirectusError && [400, 401, 403].includes(error.status)) return null;
    throw error;
  }
}

export async function requireSession(): Promise<ServerSession> {
  const session = await getSession();
  if (!session) throw new AuthRequiredError();
  return session;
}

export async function requireAdminSession(): Promise<ServerSession> {
  const session = await requireSession();
  if (!session.user.isAdmin) {
    throw new AuthRequiredError("Administrator access is required", 403, "ADMIN_REQUIRED");
  }
  return session;
}
