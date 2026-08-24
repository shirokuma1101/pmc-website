import type { DirectusSessionData } from "@/types/directus";

export const SESSION_COOKIE = "pmc_website_session";
export const TFA_SETUP_COOKIE = "pmc_website_tfa_setup";
export const TFA_SETUP_TTL_SECONDS = 10 * 60;

const secureCookie = process.env.AUTH_COOKIE_SECURE === undefined
  ? process.env.NODE_ENV === "production"
  : process.env.AUTH_COOKIE_SECURE.toLowerCase() === "true";

export const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: secureCookie,
  path: "/",
};

export function sessionCookieOptions(tokens: DirectusSessionData) {
  const seconds = Math.max(1, Math.floor(tokens.expires / 1_000));
  return { ...baseCookieOptions, maxAge: seconds };
}

export const tfaSetupCookieOptions = {
  ...baseCookieOptions,
  sameSite: "strict" as const,
  path: "/api/auth/tfa",
  maxAge: TFA_SETUP_TTL_SECONDS,
};
