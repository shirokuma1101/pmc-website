import { dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { getAboutContent, updateAboutContent } from "@/lib/directus/about";
import { assertSameOrigin } from "@/lib/security/csrf";
import { aboutContentSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return withRouteErrors(async () => {
    const session = await requireAdminSession();
    return dataResponse(await getAboutContent(session.accessToken), 200, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
}

export async function PUT(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const content = aboutContentSchema.parse(await readJson(request));
    await updateAboutContent(content, session.accessToken);
    return dataResponse(content);
  });
}
