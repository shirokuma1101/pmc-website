import { z } from "zod";

import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { updateOrganizationSupporterTier } from "@/lib/directus/organization";
import { SUPPORTER_TIER_KEYS } from "@/lib/organization/supporter";
import { assertSameOrigin } from "@/lib/security/csrf";

const supporterSchema = z.object({
  tier: z.enum(SUPPORTER_TIER_KEYS).nullable(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext<"/api/admin/organization/[id]/supporter">): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { id } = await context.params;
    const { tier } = supporterSchema.parse(await readJson(request));
    return dataResponse(await updateOrganizationSupporterTier(id, tier, session.accessToken));
  });
}
