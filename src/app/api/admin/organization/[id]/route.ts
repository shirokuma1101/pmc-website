import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { deleteOrganizationMember, updateOrganizationMember } from "@/lib/directus/organization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { organizationMemberSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext<"/api/admin/organization/[id]">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { id } = await context.params;
    const input = organizationMemberSchema.parse(await readJson(request));
    return dataResponse(await updateOrganizationMember(id, input, session.accessToken));
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/admin/organization/[id]">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { id } = await context.params;
    await deleteOrganizationMember(id, session.accessToken);
    return new Response(null, { status: 204 });
  });
}
