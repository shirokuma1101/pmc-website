import { NextRequest, NextResponse } from "next/server";
import { dataResponse, withRouteErrors } from "@/lib/api/route";
import { formFiles, formString, formStrings, isMultipart, readObjectBody } from "@/lib/api/forms";
import { requireSession } from "@/lib/auth/session";
import { assertStoredImages, uploadImages } from "@/lib/directus/files";
import { deletePost, getPost, updatePost } from "@/lib/directus/posts";
import { assertSameOrigin } from "@/lib/security/csrf";
import { adminPostFieldsSchema, idSchema, updatePostSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

async function routeId(context: RouteContext): Promise<string> {
  return idSchema.parse((await context.params).id);
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => dataResponse(await getPost(await routeId(context))));
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    const id = await routeId(context);

    if (isMultipart(request)) {
      const form = await request.formData();
      const files = formFiles(form, "images");
      const existingIds = formStrings(form, "fileIds");
      const content = form.has("content") ? formString(form, "content") ?? "" : undefined;
      const mockFileIds = [...existingIds, ...files.map(() => crypto.randomUUID())];
      const validated = updatePostSchema.parse({
        ...(content !== undefined ? { content } : {}),
        ...(mockFileIds.length ? { fileIds: mockFileIds } : {}),
      });
      await assertStoredImages(existingIds, session.user.id, session.accessToken);
      const uploadedIds = await uploadImages(files, session.accessToken);
      await assertStoredImages(uploadedIds, session.user.id, session.accessToken);
      const post = await updatePost(id, {
        ...(validated.content !== undefined ? { content: validated.content } : {}),
        ...(existingIds.length || uploadedIds.length ? { fileIds: [...existingIds, ...uploadedIds] } : {}),
      }, session.accessToken);
      return dataResponse(post);
    }

    const body = await readObjectBody(request);
    const adminFields = session.user.isAdmin ? adminPostFieldsSchema.parse({
      ...(body.authorId !== undefined ? { authorId: body.authorId } : {}),
      ...(body.createdAt !== undefined ? { createdAt: body.createdAt } : {}),
    }) : {};
    const input = updatePostSchema.parse(session.user.isAdmin ? {
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.fileIds !== undefined ? { fileIds: body.fileIds } : {}),
    } : body);
    await assertStoredImages(input.fileIds ?? [], session.user.id, session.accessToken);
    return dataResponse(await updatePost(id, { ...input, ...adminFields }, session.accessToken));
  });
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    await deletePost(await routeId(context), session.accessToken);
    return new NextResponse(null, { status: 204 });
  });
}
