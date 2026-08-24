import { getAppOrigins } from "@/lib/config";

export class CsrfError extends Error {
  readonly status = 403;
  readonly code = "CSRF_REJECTED";

  constructor(message = "Cross-origin request rejected") {
    super(message);
    this.name = "CsrfError";
  }
}

export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new CsrfError();
  }

  const origin = request.headers.get("origin");
  let parsedOrigin: string | undefined;
  try {
    parsedOrigin = origin ? new URL(origin).origin : undefined;
  } catch {
    parsedOrigin = undefined;
  }
  if (!parsedOrigin || !getAppOrigins(request.url).has(parsedOrigin)) {
    throw new CsrfError();
  }
}
