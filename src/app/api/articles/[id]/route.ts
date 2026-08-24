import { NextResponse } from "next/server";
import { ApiRouteError, dataResponse, withRouteErrors } from "@/lib/api/route";
import { formString, isMultipart, readObjectBody } from "@/lib/api/forms";
import { getSession, requireSession } from "@/lib/auth/session";
import {
  deleteArticle,
  getArticleById,
  updateArticle,
} from "@/lib/directus/articles";
import { assertStoredImages } from "@/lib/directus/files";
import { storedImageIdsInMarkdown } from "@/lib/articles/images";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema, updateArticleSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function routeId(context: RouteContext): Promise<string> {
  return idSchema.parse((await context.params).id);
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    const session = await getSession();
    const article = await getArticleById(await routeId(context), session?.accessToken);
    if (!article) throw new ApiRouteError("Article not found", 404, "NOT_FOUND");
    return dataResponse(article, 200, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const id = await routeId(context);
    let input: Record<string, unknown>;

    if (isMultipart(request)) {
      const form = await request.formData();
      input = {
        ...(form.has("title") ? { title: formString(form, "title") ?? "" } : {}),
        ...(form.has("slug") ? { slug: formString(form, "slug") ?? "" } : {}),
        ...(form.has("summary") ? { summary: formString(form, "summary") ?? "" } : {}),
        ...(form.has("tags")
          ? { tags: (formString(form, "tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean) }
          : {}),
        ...(form.has("body") ? { body: formString(form, "body") ?? "" } : {}),
      };
    } else {
      input = await readObjectBody(request);
    }

    const validated = updateArticleSchema.parse(input);
    if (validated.body !== undefined) {
      await assertStoredImages(
        storedImageIdsInMarkdown(validated.body),
        session.user.id,
        session.accessToken,
        session.user.isAdmin,
      );
    }
    const article = await updateArticle(id, {
      ...validated,
    }, session.accessToken);
    return dataResponse(article);
  });
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    await deleteArticle(await routeId(context), session.accessToken);
    return new NextResponse(null, { status: 204 });
  });
}
