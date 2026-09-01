import { z } from "zod";

import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { createOrganizationTeam } from "@/lib/directus/organization";
import { assertSameOrigin } from "@/lib/security/csrf";

const teamSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const { name } = teamSchema.parse(await readJson(request));
    await createOrganizationTeam(name, session.accessToken);
    return dataResponse({ name }, 201);
  });
}
