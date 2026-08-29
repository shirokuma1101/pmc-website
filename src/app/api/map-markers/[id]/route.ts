import { NextResponse } from "next/server";
import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { deleteMapMarker, updateMapMarker } from "@/lib/minecraft-map/markers";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema, updateMapMarkerSchema } from "@/lib/validation/schemas";

type Context = { params: Promise<{ id: string }> };
async function markerId(context: Context) { return idSchema.parse((await context.params).id); }

export async function PATCH(request: Request, context: Context) {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    return dataResponse(await updateMapMarker(
      await markerId(context), updateMapMarkerSchema.parse(await readJson(request)), session.accessToken,
    ));
  });
}

export async function DELETE(request: Request, context: Context) {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    await deleteMapMarker(await markerId(context), session.accessToken);
    return new NextResponse(null, { status: 204 });
  });
}
