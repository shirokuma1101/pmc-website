import { z } from "zod";

import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { updateOrganizationHighlight } from "@/lib/directus/organization";
import { assertSameOrigin } from "@/lib/security/csrf";

const highlightSchema = z.object({ enabled: z.boolean() }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext<"/api/admin/organization/[id]/highlight">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { id } = await context.params;
    const { enabled } = highlightSchema.parse(await readJson(request));
    await updateOrganizationHighlight(id, enabled, session.accessToken);
    return dataResponse({ enabled });
  });
}
