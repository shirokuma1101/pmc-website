import { ApiRouteError, dataResponse, withRouteErrors } from "@/lib/api/route";
import { formFiles, isMultipart } from "@/lib/api/forms";
import { requireSession } from "@/lib/auth/session";
import { directusAssetUrl } from "@/lib/config";
import { assertStoredImages, uploadImage } from "@/lib/directus/files";
import { assertSameOrigin } from "@/lib/security/csrf";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    if (!isMultipart(request)) {
      throw new ApiRouteError("multipart/form-data is required", 415, "UNSUPPORTED_MEDIA_TYPE");
    }
    const form = await request.formData();
    const image = formFiles(form, "image")[0];
    if (!image) {
      throw new ApiRouteError("画像を選択してください。", 400, "VALIDATION_ERROR");
    }
    const id = await uploadImage(image, session.accessToken);
    await assertStoredImages([id], session.user.id, session.accessToken);
    return dataResponse({ id, url: directusAssetUrl(id) }, 201, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
}
