import { NextRequest } from "next/server";
import { ApiRouteError, dataResponse, withRouteErrors } from "@/lib/api/route";
import { formFiles, formString, isMultipart, readObjectBody } from "@/lib/api/forms";
import { getSession, requireSession } from "@/lib/auth/session";
import { assertStoredImages, uploadImage } from "@/lib/directus/files";
import {
  getProfile,
  getProfileByUserId,
  upsertMyProfile,
} from "@/lib/directus/profiles";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema, profileSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return withRouteErrors(async () => {
    const userIdValue = request.nextUrl.searchParams.get("userId");
    const profileIdValue = request.nextUrl.searchParams.get("id");
    const session = await getSession();

    let profile;
    if (userIdValue) {
      profile = await getProfileByUserId(idSchema.parse(userIdValue), session?.accessToken);
    } else if (profileIdValue) {
      profile = await getProfile(idSchema.parse(profileIdValue), session?.accessToken);
    } else {
      if (!session) throw new ApiRouteError("Authentication is required", 401, "AUTH_REQUIRED");
      profile = await getProfileByUserId(session.user.id, session.accessToken);
    }
    if (!profile) throw new ApiRouteError("Profile not found", 404, "NOT_FOUND");
    return dataResponse(profile, 200, {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
}

async function upsert(request: Request): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireSession();
    let input: Record<string, unknown>;
    let avatar: File | undefined;

    if (isMultipart(request)) {
      const form = await request.formData();
      avatar = formFiles(form, "avatar")[0];
      input = {
        displayName: formString(form, "displayName") ?? "",
        bio: formString(form, "bio") ?? "",
        xboxGamertag: formString(form, "xboxGamertag") ?? "",
        ...(form.has("avatarId") ? { avatarId: formString(form, "avatarId") || null } : {}),
        ...(formString(form, "removeAvatar") === "true" ? { avatarId: null } : {}),
        ...(avatar ? { avatarId: crypto.randomUUID() } : {}),
      };
    } else {
      input = await readObjectBody(request);
    }

    const validated = profileSchema.parse(input);
    if (validated.avatarId && !avatar) {
      await assertStoredImages(
        [validated.avatarId],
        session.user.id,
        session.accessToken,
      );
    }
    const avatarId = avatar
      ? await uploadImage(avatar, session.accessToken)
      : validated.avatarId;
    if (avatarId && avatar) {
      await assertStoredImages([avatarId], session.user.id, session.accessToken);
    }
    const profile = await upsertMyProfile(session.user.id, {
      displayName: validated.displayName,
      bio: validated.bio,
      xboxGamertag: validated.xboxGamertag,
      ...(avatarId !== undefined ? { avatarId } : {}),
    }, session.accessToken);
    return dataResponse(profile);
  });
}

export const PATCH = upsert;
export const PUT = upsert;
