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
import { newlyReferencedImageIds } from "@/lib/articles/images";
import { assertSameOrigin } from "@/lib/security/csrf";
import { adminArticleFieldsSchema, idSchema, updateArticleSchema } from "@/lib/validation/schemas";

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
    let adminInput: { authorId?: string; createdAt?: string; publishedAt?: string } = {};

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
        ...(form.has("eventAt")
          ? { eventAt: formString(form, "eventAt") || null }
          : {}),
      };
      if (session.user.isAdmin) {
        adminInput = adminArticleFieldsSchema.parse({
          ...(formString(form, "authorId") ? { authorId: formString(form, "authorId") } : {}),
          ...(formString(form, "createdAt") ? { createdAt: formString(form, "createdAt") } : {}),
          ...(formString(form, "publishedAt") ? { publishedAt: formString(form, "publishedAt") } : {}),
        });
      }
    } else {
      const body = await readObjectBody(request);
      input = session.user.isAdmin ? {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.summary !== undefined ? { summary: body.summary } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.eventAt !== undefined ? { eventAt: body.eventAt } : {}),
      } : body;
      if (session.user.isAdmin) {
        adminInput = adminArticleFieldsSchema.parse({
          ...(body.authorId !== undefined ? { authorId: body.authorId } : {}),
          ...(body.createdAt !== undefined ? { createdAt: body.createdAt } : {}),
          ...(body.publishedAt !== undefined ? { publishedAt: body.publishedAt } : {}),
        });
      }
    }

    const validated = updateArticleSchema.parse(input);
    if (validated.body !== undefined) {
      const existingArticle = await getArticleById(id, session.accessToken);
      if (!existingArticle) throw new ApiRouteError("Article not found", 404, "NOT_FOUND");
      await assertStoredImages(
        newlyReferencedImageIds(existingArticle.body, validated.body),
        session.user.id,
        session.accessToken,
        session.user.isAdmin,
      );
    }
    const article = await updateArticle(id, {
      ...validated,
      ...adminInput,
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
