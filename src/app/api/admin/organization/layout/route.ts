import { z } from "zod";

import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { updateOrganizationLayout } from "@/lib/directus/organization";
import { ORGANIZATION_GROUP_COLOR_KEYS } from "@/lib/organization/palette";
import { assertSameOrigin } from "@/lib/security/csrf";

const layoutSchema = z.object({ sections: z.array(z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200),
  groups: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    caption: z.string().trim().max(80),
    color: z.enum(ORGANIZATION_GROUP_COLOR_KEYS).optional(),
  }).strict()).max(50),
}).strict()).max(20) }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { sections } = layoutSchema.parse(await readJson(request));
    await updateOrganizationLayout(sections, session.accessToken);
    return dataResponse({ sections });
  });
}
