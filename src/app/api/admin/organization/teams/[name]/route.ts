import { z } from "zod";

import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { deleteOrganizationTeam, renameOrganizationTeam } from "@/lib/directus/organization";
import { assertSameOrigin } from "@/lib/security/csrf";

const teamSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext<"/api/admin/organization/teams/[name]">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { name: currentName } = await context.params;
    const { name } = teamSchema.parse(await readJson(request));
    await renameOrganizationTeam(currentName, name, session.accessToken);
    return dataResponse({ name });
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/admin/organization/teams/[name]">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { name } = await context.params;
    await deleteOrganizationTeam(name, session.accessToken);
    return new Response(null, { status: 204 });
  });
}
