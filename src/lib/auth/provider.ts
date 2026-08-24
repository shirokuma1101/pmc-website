import "server-only";

import { DirectusError, directusRequest, directusResponse } from "@/lib/directus/client";
import { DIRECTUS_APP_ENDPOINT } from "@/lib/directus/constants";
import { mapUserSummary } from "@/lib/directus/mappers";
import type { SessionUser } from "@/types";
import type {
  DirectusItemResponse,
  DirectusJsonLoginResponse,
  DirectusSessionData,
  DirectusSessionLoginResponse,
  DirectusTwoFactorSetupResponse,
  DirectusUserRaw,
} from "@/types/directus";

const DIRECTUS_SESSION_COOKIE = "directus_session_token";

export interface PasswordCredentials {
  email: string;
  password: string;
  otp?: string;
}

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
}

export interface AuthenticationProvider {
  login(credentials: PasswordCredentials): Promise<DirectusSessionData>;
  logout(sessionToken: string): Promise<void>;
  currentUser(accessToken: string): Promise<SessionUser>;
}

function readSessionToken(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(
    new RegExp(`(?:^|,\\s*)${DIRECTUS_SESSION_COOKIE}=([^;]+)`),
  );
  if (!match?.[1]) {
    throw new DirectusError(
      "Directus did not return a session token",
      502,
      "INVALID_AUTH_RESPONSE",
    );
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function loginDirectus(credentials: PasswordCredentials): Promise<DirectusSessionData> {
  const response = await directusResponse("/auth/login", {
    method: "POST",
    body: { ...credentials, mode: "session" },
  });
  const payload = await response.json() as DirectusSessionLoginResponse;
  return {
    session_token: readSessionToken(response),
    expires: payload.data.expires,
  };
}

export async function registerDirectus(input: { displayName: string; email: string; password: string }): Promise<void> {
  await directusResponse(`${DIRECTUS_APP_ENDPOINT}/register`, {
    method: "POST",
    body: {
      display_name: input.displayName,
      email: input.email,
      password: input.password,
    },
  });
}

export async function requestPasswordResetDirectus(email: string, resetUrl: string): Promise<void> {
  await directusResponse("/auth/password/request", {
    method: "POST",
    body: { email, reset_url: resetUrl },
  });
}

export async function resetPasswordDirectus(token: string, password: string): Promise<void> {
  await directusResponse("/auth/password/reset", {
    method: "POST",
    body: { token, password },
  });
}

export async function logoutDirectus(sessionToken: string): Promise<void> {
  await directusResponse("/auth/logout", {
    method: "POST",
    headers: {
      Cookie: `${DIRECTUS_SESSION_COOKIE}=${encodeURIComponent(sessionToken)}`,
    },
    body: { mode: "session" },
  });
}

export async function getCurrentUser(accessToken: string): Promise<SessionUser> {
  const authorityResponse = await directusRequest<DirectusItemResponse<DirectusUserRaw & {
      id: string;
      email: string;
      isAdmin: boolean;
      tfaEnabled: boolean;
    }>>(`${DIRECTUS_APP_ENDPOINT}/session`, {
      accessToken,
    });
  const summary = mapUserSummary(authorityResponse.data);
  return {
    ...summary,
    email: authorityResponse.data.email,
    isAdmin: authorityResponse.data.isAdmin,
    tfaEnabled: authorityResponse.data.tfaEnabled,
  };
}

export async function generateTwoFactorSetup(
  accessToken: string,
  password: string,
): Promise<TwoFactorSetup> {
  const response = await directusRequest<DirectusTwoFactorSetupResponse>(
    "/users/me/tfa/generate",
    {
      method: "POST",
      accessToken,
      body: { password },
    },
  );
  return {
    secret: response.data.secret,
    otpauthUrl: response.data.otpauth_url,
  };
}

export async function enableTwoFactor(
  accessToken: string,
  secret: string,
  otp: string,
): Promise<void> {
  await directusResponse("/users/me/tfa/enable", {
    method: "POST",
    accessToken,
    body: { secret, otp },
  });
}

export async function disableTwoFactor(
  accessToken: string,
  password: string,
  otp: string,
): Promise<void> {
  const currentUser = await directusRequest<DirectusItemResponse<{ email: string }>>(
    `${DIRECTUS_APP_ENDPOINT}/session`,
    {
      accessToken,
    },
  );
  const verified = await directusRequest<DirectusJsonLoginResponse>("/auth/login", {
    method: "POST",
    body: {
      email: currentUser.data.email,
      password,
      otp,
      mode: "json",
    },
  });
  try {
    await directusResponse("/auth/logout", {
      method: "POST",
      body: { refresh_token: verified.data.refresh_token, mode: "json" },
    });
  } catch {
    // The short-lived verification session is also removed by revokeAllSessions.
  }
  await directusResponse("/users/me/tfa/disable", {
    method: "POST",
    accessToken,
    body: { otp },
  });
}

export async function revokeAllSessions(accessToken: string): Promise<void> {
  await directusResponse(`${DIRECTUS_APP_ENDPOINT}/session/revoke-all`, {
    method: "POST",
    accessToken,
  });
}

export const directusAuthenticationProvider: AuthenticationProvider = {
  login: loginDirectus,
  logout: logoutDirectus,
  currentUser: getCurrentUser,
};
