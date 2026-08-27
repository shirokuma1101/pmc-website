import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { updateWorldsContent } from "@/lib/directus/worlds";
import { assertSameOrigin } from "@/lib/security/csrf";
import { worldsContentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const content = worldsContentSchema.parse(await readJson(request));
    await updateWorldsContent(content, session.accessToken);
    return dataResponse(content);
  });
}
