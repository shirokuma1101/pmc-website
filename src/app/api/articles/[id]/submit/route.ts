import { dataResponse, withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { submitArticle } from "@/lib/directus/articles";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const id = idSchema.parse((await context.params).id);
    return dataResponse(await submitArticle(id, session.accessToken));
  });
}
