import "server-only";

import { randomUUID } from "node:crypto";
import sharp, { type Sharp } from "sharp";
import { ApiRouteError } from "@/lib/api/route";

const IMAGE_FORMATS = {
  "image/jpeg": { extension: "jpg", format: "jpeg" },
  "image/png": { extension: "png", format: "png" },
  "image/webp": { extension: "webp", format: "webp" },
  "image/gif": { extension: "gif", format: "gif" },
} as const;

type SupportedMimeType = keyof typeof IMAGE_FORMATS;
type SupportedImageFormat = (typeof IMAGE_FORMATS)[SupportedMimeType]["format"];

const DEFAULT_MAXIMUM_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAXIMUM_INPUT_PIXELS = 40_000_000;

export interface SanitizedImage {
  bytes: ArrayBuffer;
  filename: string;
  mimeType: SupportedMimeType;
}

function positiveIntegerFromEnvironment(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function maximumImageBytes(): number {
  return positiveIntegerFromEnvironment(
    "MAX_IMAGE_UPLOAD_BYTES",
    DEFAULT_MAXIMUM_IMAGE_BYTES,
  );
}

export function maximumInputPixels(): number {
  return positiveIntegerFromEnvironment(
    "MAX_IMAGE_INPUT_PIXELS",
    DEFAULT_MAXIMUM_INPUT_PIXELS,
  );
}

function imageDefinition(file: File) {
  const definition = IMAGE_FORMATS[file.type.toLowerCase() as SupportedMimeType];

  if (!definition) {
    throw new ApiRouteError(
      "Only JPEG, PNG, WebP, and GIF images are allowed",
      415,
      "INVALID_IMAGE_TYPE",
    );
  }

  return {
    ...definition,
    mimeType: file.type.toLowerCase() as SupportedMimeType,
  };
}

export function assertImageUpload(file: File): void {
  imageDefinition(file);

  if (file.size <= 0 || file.size > maximumImageBytes()) {
    throw new ApiRouteError(
      "Image exceeds the configured size limit",
      413,
      "IMAGE_TOO_LARGE",
    );
  }
}

function assertDecodedImage(
  metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>,
  expectedFormat: SupportedImageFormat,
): void {
  if (metadata.format !== expectedFormat) {
    throw new ApiRouteError(
      "The uploaded image content does not match its declared type",
      415,
      "INVALID_IMAGE_CONTENT",
    );
  }

  const width = metadata.width;
  const frameHeight = metadata.pageHeight ?? metadata.height;
  const pages = metadata.pages ?? 1;
  const maximumPixels = maximumInputPixels();

  if (
    !width ||
    !frameHeight ||
    !Number.isSafeInteger(pages) ||
    pages < 1 ||
    width * frameHeight * pages > maximumPixels
  ) {
    throw new ApiRouteError(
      "Image dimensions exceed the configured pixel limit",
      413,
      "IMAGE_DIMENSIONS_TOO_LARGE",
    );
  }
}

function reencode(
  image: Sharp,
  format: SupportedImageFormat,
): Promise<Buffer> {
  const oriented = image.rotate();

  switch (format) {
    case "jpeg":
      return oriented.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    case "png":
      return oriented.png({ compressionLevel: 9 }).toBuffer();
    case "webp":
      return oriented.webp({ quality: 88, effort: 5 }).toBuffer();
    case "gif":
      return oriented.gif({ effort: 7 }).toBuffer();
  }
}

/**
 * Decodes and re-encodes an image without copying EXIF, GPS, ICC, XMP, or
 * other source metadata. Sharp strips metadata unless explicitly asked to
 * retain it; rotate() applies the EXIF orientation before it is discarded.
 */
export async function sanitizeImageUpload(file: File): Promise<SanitizedImage> {
  assertImageUpload(file);
  const definition = imageDefinition(file);
  const input = Buffer.from(await file.arrayBuffer());
  const maximumPixels = maximumInputPixels();

  try {
    const image = sharp(input, {
      animated: definition.format === "gif",
      failOn: "error",
      limitInputPixels: maximumPixels,
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    assertDecodedImage(metadata, definition.format);
    const output = await reencode(image, definition.format);

    if (output.length <= 0 || output.length > maximumImageBytes()) {
      throw new ApiRouteError(
        "The processed image exceeds the configured size limit",
        413,
        "IMAGE_TOO_LARGE",
      );
    }

    const bytes = new Uint8Array(output.length);
    bytes.set(output);

    return {
      bytes: bytes.buffer,
      filename: `pmc-website-${randomUUID()}.${definition.extension}`,
      mimeType: definition.mimeType,
    };
  } catch (error) {
    if (error instanceof ApiRouteError) throw error;

    const message = error instanceof Error ? error.message : "";
    if (/pixel limit/i.test(message)) {
      throw new ApiRouteError(
        "Image dimensions exceed the configured pixel limit",
        413,
        "IMAGE_DIMENSIONS_TOO_LARGE",
      );
    }

    throw new ApiRouteError(
      "The uploaded image could not be decoded safely",
      415,
      "INVALID_IMAGE_CONTENT",
    );
  }
}
