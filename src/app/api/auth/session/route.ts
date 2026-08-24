import { NextResponse } from "next/server";
import { withRouteErrors } from "@/lib/api/route";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return withRouteErrors(async () => {
    const session = await getSession();
    return NextResponse.json(session
      ? { data: { user: session.user }, authenticated: true }
      : { data: null, authenticated: false }, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  });
}
