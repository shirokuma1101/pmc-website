import { NextRequest, NextResponse } from "next/server";
import { dataResponse, withRouteErrors } from "@/lib/api/route";
import { formString, isMultipart, readObjectBody } from "@/lib/api/forms";
import { getSession, requireSession } from "@/lib/auth/session";
import {
  createArticle,
  getOwnArticles,
  getPublishedArticles,
} from "@/lib/directus/articles";
import { assertStoredImages } from "@/lib/directus/files";
import { storedImageIdsInMarkdown } from "@/lib/articles/images";
import { assertSameOrigin } from "@/lib/security/csrf";
import {
  adminArticleFieldsSchema,
  articleStatusSchema,
  createArticleSchema,
  idSchema,
  paginationSchema,
  slugify,
} from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return withRouteErrors(async () => {
    const search = request.nextUrl.searchParams;
    const { page, limit } = paginationSchema.parse({
      page: search.get("page") ?? undefined,
      limit: search.get("limit") ?? undefined,
    });
    if (search.get("scope") === "mine") {
      const session = await requireSession();
      const statusValue = search.get("status");
      const status = statusValue ? articleStatusSchema.parse(statusValue) : undefined;
      const result = await getOwnArticles(session.user.id, session.accessToken, { page, limit, status });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    const authorValue = search.get("authorId") ?? undefined;
    const authorId = authorValue ? idSchema.parse(authorValue) : undefined;
    const session = await getSession();
    const result = await getPublishedArticles({
      page,
      limit,
      authorId,
      tag: search.get("tag")?.trim().slice(0, 30) || undefined,
      accessToken: session?.accessToken,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    let input: Record<string, unknown>;
    let adminInput: { authorId?: string; createdAt?: string; publishedAt?: string } = {};

    if (isMultipart(request)) {
      const form = await request.formData();
      input = {
        title: formString(form, "title") ?? "",
        ...(formString(form, "slug") ? { slug: formString(form, "slug") } : {}),
        summary: formString(form, "summary") ?? "",
        tags: (formString(form, "tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
        body: formString(form, "body") ?? "",
        eventAt: formString(form, "eventAt") || null,
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
        title: body.title,
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        summary: body.summary,
        tags: body.tags,
        body: body.body,
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

    const validated = createArticleSchema.parse(input);
    await assertStoredImages(
      storedImageIdsInMarkdown(validated.body),
      session.user.id,
      session.accessToken,
    );
    const article = await createArticle({
      title: validated.title,
      slug: validated.slug
        ?? `${slugify(validated.title)}-${crypto.randomUUID().slice(0, 8)}`,
      summary: validated.summary,
      tags: validated.tags,
      body: validated.body,
      eventAt: validated.eventAt,
      ...adminInput,
    }, session.accessToken);
    return dataResponse(article, 201);
  });
}
