import type { DirectusFileRaw, DirectusItemResponse } from "@/types/directus";
import { ApiRouteError } from "@/lib/api/route";
import { directusRequest } from "./client";
import {
  DIRECTUS_APP_ENDPOINT,
  DIRECTUS_UPLOAD_FILENAME_PATTERN,
  DIRECTUS_UPLOAD_FOLDER_ID,
} from "./constants";
import { assertImageUpload, sanitizeImageUpload } from "./image-processing";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function assertImageFile(file: File): void {
  assertImageUpload(file);
}

export async function uploadImage(file: File, accessToken: string): Promise<string> {
  const sanitized = await sanitizeImageUpload(file);
  const response = await directusRequest<DirectusItemResponse<DirectusFileRaw>>(
    `${DIRECTUS_APP_ENDPOINT}/files`,
    {
      method: "POST",
      accessToken,
      body: {
        filename: sanitized.filename,
        type: sanitized.mimeType,
        data: Buffer.from(sanitized.bytes).toString("base64"),
      },
    },
  );
  return response.data.id;
}

export async function uploadImages(files: File[], accessToken: string): Promise<string[]> {
  if (files.length > 4) {
    throw new ApiRouteError("A maximum of four images is allowed", 400, "TOO_MANY_IMAGES");
  }
  files.forEach(assertImageFile);
  const ids: string[] = [];
  // Sequential uploads avoid a single user consuming all Directus upload workers.
  for (const file of files) ids.push(await uploadImage(file, accessToken));
  return ids;
}

function uploadedById(file: DirectusFileRaw): string | undefined {
  if (typeof file.uploaded_by === "string") return file.uploaded_by;
  return file.uploaded_by?.id;
}

export async function assertStoredImages(
  fileIds: string[],
  ownerId: string,
  accessToken: string,
  allowAnyOwner = false,
): Promise<void> {
  await Promise.all(fileIds.map(async (id) => {
    const response = await directusRequest<DirectusItemResponse<DirectusFileRaw>>(
      `${DIRECTUS_APP_ENDPOINT}/files/${encodeURIComponent(id)}`,
      {
        accessToken,
      },
    );
    const type = response.data.type?.toLowerCase() ?? "";
    if (!ALLOWED_IMAGE_TYPES.has(type)) {
      throw new ApiRouteError("Referenced files must be supported images", 415, "INVALID_IMAGE_TYPE");
    }
    if (!allowAnyOwner && uploadedById(response.data) !== ownerId) {
      throw new ApiRouteError(
        "Referenced images must have been uploaded by the current user",
        403,
        "IMAGE_NOT_OWNED",
      );
    }
    if (
      response.data.folder !== DIRECTUS_UPLOAD_FOLDER_ID
      || !response.data.filename_download
      || !DIRECTUS_UPLOAD_FILENAME_PATTERN.test(response.data.filename_download)
    ) {
      throw new ApiRouteError(
        "Referenced images must be sanitized PostMineClan uploads",
        400,
        "UNSAFE_IMAGE_REFERENCE",
      );
    }
  }));
}
