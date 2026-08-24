import { NextRequest, NextResponse } from "next/server";
import { dataResponse, withRouteErrors } from "@/lib/api/route";
import { formFiles, formString, formStrings, isMultipart, readObjectBody } from "@/lib/api/forms";
import { requireSession } from "@/lib/auth/session";
import { assertStoredImages, uploadImages } from "@/lib/directus/files";
import { createPost, getPosts } from "@/lib/directus/posts";
import { assertSameOrigin } from "@/lib/security/csrf";
import { adminPostFieldsSchema, idSchema, paginationSchema, postSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return withRouteErrors(async () => {
    const search = request.nextUrl.searchParams;
    const { page, limit } = paginationSchema.parse({
      page: search.get("page") ?? undefined,
      limit: search.get("limit") ?? undefined,
    });
    const authorValue = search.get("authorId") ?? undefined;
    const authorId = authorValue ? idSchema.parse(authorValue) : undefined;
    const result = await getPosts({ page, limit, authorId });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();

    if (isMultipart(request)) {
      const form = await request.formData();
      const files = formFiles(form, "images");
      const existingIds = formStrings(form, "fileIds");
      const adminFields = session.user.isAdmin ? adminPostFieldsSchema.parse({
        ...(formString(form, "authorId") ? { authorId: formString(form, "authorId") } : {}),
        ...(formString(form, "createdAt") ? { createdAt: formString(form, "createdAt") } : {}),
      }) : {};
      const validated = postSchema.parse({
        content: formString(form, "content") ?? "",
        fileIds: [...existingIds, ...files.map(() => crypto.randomUUID())],
      });
      await assertStoredImages(existingIds, session.user.id, session.accessToken);
      const uploadedIds = await uploadImages(files, session.accessToken);
      await assertStoredImages(uploadedIds, session.user.id, session.accessToken);
      const post = await createPost({
        content: validated.content,
        fileIds: [...existingIds, ...uploadedIds],
        ...adminFields,
      }, session.accessToken);
      return dataResponse(post, 201);
    }

    const body = await readObjectBody(request);
    const adminFields = session.user.isAdmin ? adminPostFieldsSchema.parse({
      ...(body.authorId !== undefined ? { authorId: body.authorId } : {}),
      ...(body.createdAt !== undefined ? { createdAt: body.createdAt } : {}),
    }) : {};
    const input = postSchema.parse(session.user.isAdmin
      ? { content: body.content, fileIds: body.fileIds }
      : body);
    await assertStoredImages(input.fileIds, session.user.id, session.accessToken);
    const post = await createPost({ ...input, ...adminFields }, session.accessToken);
    return dataResponse(post, 201);
  });
}
