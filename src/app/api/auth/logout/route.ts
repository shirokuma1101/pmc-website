import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withRouteErrors } from "@/lib/api/route";
import { clearSessionCookie, getSessionToken } from "@/lib/auth/session";
import { TFA_SETUP_COOKIE, tfaSetupCookieOptions } from "@/lib/auth/cookies";
import { DirectusError } from "@/lib/directus/client";
import { logoutDirectus } from "@/lib/auth/provider";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const sessionToken = await getSessionToken();
    if (sessionToken) {
      try {
        await logoutDirectus(sessionToken);
      } catch (error) {
        if (!(error instanceof DirectusError) || ![400, 401, 403].includes(error.status)) throw error;
      }
    }
    await clearSessionCookie();
    (await cookies()).set(TFA_SETUP_COOKIE, "", {
      ...tfaSetupCookieOptions,
      maxAge: 0,
    });
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  });
}
