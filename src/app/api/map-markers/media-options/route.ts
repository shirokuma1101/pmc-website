import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { withRouteErrors } from "@/lib/api/route";
import { getMarkerMediaOptions } from "@/lib/minecraft-map/markers";

export async function GET() {
  return withRouteErrors(async () => {
    const session = await requireSession();
    return NextResponse.json({ data: await getMarkerMediaOptions(session.accessToken) }, {
      headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
    });
  });
}
