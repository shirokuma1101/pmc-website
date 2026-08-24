import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  baseCookieOptions,
} from "@/lib/auth/cookies";
import { getCurrentUser } from "@/lib/auth/provider";

function isProtectedPath(pathname: string): boolean {
  return pathname === "/me"
    || pathname === "/settings/security"
    || pathname === "/article/new"
    || /^\/article\/[^/]+\/edit\/?$/.test(pathname)
    || pathname === "/admin"
    || pathname.startsWith("/admin/");
}

function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...baseCookieOptions, maxAge: 0 });
}

function loginRedirect(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) return loginRedirect(request);

  try {
    const user = await getCurrentUser(sessionToken);
    if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !user.isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch {
    const response = loginRedirect(request);
    clearSession(response);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
