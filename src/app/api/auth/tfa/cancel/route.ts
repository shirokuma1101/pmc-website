import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withRouteErrors } from "@/lib/api/route";
import { TFA_SETUP_COOKIE, tfaSetupCookieOptions } from "@/lib/auth/cookies";
import { requireSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    await requireSession();
    (await cookies()).set(TFA_SETUP_COOKIE, "", {
      ...tfaSetupCookieOptions,
      maxAge: 0,
    });
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  });
}
