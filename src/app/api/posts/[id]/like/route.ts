import { dataResponse, withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { setPostLike } from "@/lib/directus/posts";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema } from "@/lib/validation/schemas";

type Context = { params: Promise<{ id: string }> };

async function update(request: Request, context: Context, liked: boolean) {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const id = idSchema.parse((await context.params).id);
    return dataResponse({ liked, likeCount: await setPostLike(id, liked, session.accessToken) });
  });
}

export async function POST(request: Request, context: Context) {
  return update(request, context, true);
}

export async function DELETE(request: Request, context: Context) {
  return update(request, context, false);
}
