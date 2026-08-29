import { NextResponse } from "next/server";
import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { deleteMapPath, updateMapPath } from "@/lib/minecraft-map/paths";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema, updateMapPathSchema } from "@/lib/validation/schemas";

type Context = { params: Promise<{ id: string }> };
async function pathId(context: Context) { return idSchema.parse((await context.params).id); }

export async function PATCH(request: Request, context: Context) {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    return dataResponse(await updateMapPath(
      await pathId(context), updateMapPathSchema.parse(await readJson(request)), session.accessToken,
    ));
  });
}

export async function DELETE(request: Request, context: Context) {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    await deleteMapPath(await pathId(context), session.accessToken);
    return new NextResponse(null, { status: 204 });
  });
}
