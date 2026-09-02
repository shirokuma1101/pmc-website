import { dataResponse, withRouteErrors } from "@/lib/api/route";
import { formFiles, formString } from "@/lib/api/forms";
import { requireAdminSession } from "@/lib/auth/session";
import { uploadMinecraftSkin } from "@/lib/directus/files";
import { updateOrganizationMinecraftSkin } from "@/lib/directus/organization";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext<"/api/admin/organization/[id]/minecraft-skin">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const form = await request.formData();
    const file = formFiles(form, "minecraftSkin")[0];
    const model = formString(form, "model") === "slim" ? "slim" : "classic";
    if (!file) throw new Error("Minecraft skin is required");
    const skinId = await uploadMinecraftSkin(file, session.accessToken);
    const { id } = await context.params;
    await updateOrganizationMinecraftSkin(id, skinId, model, session.accessToken);
    return dataResponse({ skinId, model });
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/admin/organization/[id]/minecraft-skin">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { id } = await context.params;
    await updateOrganizationMinecraftSkin(id, null, "classic", session.accessToken);
    return new Response(null, { status: 204 });
  });
}
