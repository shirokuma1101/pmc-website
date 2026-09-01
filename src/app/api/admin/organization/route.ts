import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { createOrganizationMember } from "@/lib/directus/organization";
import { assertSameOrigin } from "@/lib/security/csrf";
import { organizationMemberCreateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const input = organizationMemberCreateSchema.parse(await readJson(request));
    return dataResponse(await createOrganizationMember(input, session.accessToken), 201);
  });
}
