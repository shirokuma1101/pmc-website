import { ApiRouteError, dataResponse, readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import {
  getArticleById,
  getArticleReviews,
  reviewArticle,
} from "@/lib/directus/articles";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema, reviewSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function routeId(context: RouteContext): Promise<string> {
  return idSchema.parse((await context.params).id);
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    const session = await requireAdminSession();
    const id = await routeId(context);
    const [article, reviews] = await Promise.all([
      getArticleById(id, session.accessToken),
      getArticleReviews(id, session.accessToken),
    ]);
    if (!article) throw new ApiRouteError("Article not found", 404, "NOT_FOUND");
    return dataResponse({ article, reviews }, 200, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
}

async function mutate(request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const input = reviewSchema.parse(await readJson(request));
    return dataResponse(await reviewArticle(await routeId(context), input, session.accessToken));
  });
}

export const PATCH = mutate;
export const POST = mutate;
