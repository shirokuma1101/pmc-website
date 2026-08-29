import { NextRequest, NextResponse } from "next/server";
import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { createMapPath, getMapPaths } from "@/lib/minecraft-map/paths";
import { assertSameOrigin } from "@/lib/security/csrf";
import { mapPathSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRouteErrors(async () => NextResponse.json({
    data: await getMapPaths(request.nextUrl.searchParams.get("world") ?? undefined),
  }, { headers: { "Cache-Control": "public, max-age=30" } }));
}

export async function POST(request: Request) {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    return dataResponse(await createMapPath(mapPathSchema.parse(await readJson(request)), session.accessToken), 201);
  });
}
