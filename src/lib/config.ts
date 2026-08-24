const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function getDirectusUrl(): string {
  const value = process.env.DIRECTUS_URL;
  if (!value) {
    throw new Error("DIRECTUS_URL is required on the server");
  }
  return trimTrailingSlash(value);
}

export function getPublicDirectusUrl(): string {
  const value = process.env.NEXT_PUBLIC_DIRECTUS_URL ?? process.env.DIRECTUS_URL;
  if (!value) {
    throw new Error("NEXT_PUBLIC_DIRECTUS_URL or DIRECTUS_URL is required");
  }
  return trimTrailingSlash(value);
}

export function directusAssetUrl(fileId: string): string {
  return `${getPublicDirectusUrl()}/pmc-website/assets/${encodeURIComponent(fileId)}`;
}

export function getPublicAppUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;
  if (!value) throw new Error("NEXT_PUBLIC_APP_URL or APP_URL is required");
  return trimTrailingSlash(value);
}

export function getAppOrigins(requestUrl?: string): Set<string> {
  const candidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    requestUrl ? new URL(requestUrl).origin : undefined,
  ];
  return new Set(candidates.filter((value): value is string => Boolean(value)).map((value) => new URL(value).origin));
}
