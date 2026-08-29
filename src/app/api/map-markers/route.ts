import { NextRequest, NextResponse } from "next/server";
import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { createMapMarker, getMapMarkers } from "@/lib/minecraft-map/markers";
import { assertSameOrigin } from "@/lib/security/csrf";
import { mapMarkerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteErrors(async () => NextResponse.json({
    data: await getMapMarkers(request.nextUrl.searchParams.get("world") ?? undefined),
  }, { headers: { "Cache-Control": "public, max-age=30" } }));
}

export async function POST(request: Request) {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const input = mapMarkerSchema.parse(await readJson(request));
    return dataResponse(await createMapMarker(input, session.accessToken), 201);
  });
}
