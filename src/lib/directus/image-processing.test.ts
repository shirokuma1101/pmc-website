import { File as NodeFile } from "node:buffer";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { assertImageUpload, sanitizeImageUpload } from "./image-processing";

const originalMaximumBytes = process.env.MAX_IMAGE_UPLOAD_BYTES;
const originalMaximumPixels = process.env.MAX_IMAGE_INPUT_PIXELS;

function uploadedFile(
  bytes: Buffer,
  type: string,
  name = "camera-original-with-location.jpg",
): File {
  return new NodeFile([bytes], name, { type }) as unknown as File;
}

afterEach(() => {
  if (originalMaximumBytes === undefined) {
    delete process.env.MAX_IMAGE_UPLOAD_BYTES;
  } else {
    process.env.MAX_IMAGE_UPLOAD_BYTES = originalMaximumBytes;
  }

  if (originalMaximumPixels === undefined) {
    delete process.env.MAX_IMAGE_INPUT_PIXELS;
  } else {
    process.env.MAX_IMAGE_INPUT_PIXELS = originalMaximumPixels;
  }
});

describe("sanitizeImageUpload", () => {
  it("keeps Minecraft world files out of the Frontend image upload API", () => {
    const world = uploadedFile(
      Buffer.from("PK\u0003\u0004world"),
      "application/octet-stream",
      "archive.mcworld",
    );

    try {
      assertImageUpload(world);
      expect.unreachable("Minecraft world files must not be accepted as Frontend images");
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_IMAGE_TYPE", status: 415 });
    }
  });

  it("auto-orients JPEGs, strips metadata, and replaces the source filename", async () => {
    const source = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 3,
        background: { r: 30, g: 90, b: 150 },
      },
    })
      .jpeg()
      .withMetadata({
        orientation: 6,
        exif: { IFD0: { Artist: "Private author" } },
      })
      .toBuffer();

    const result = await sanitizeImageUpload(uploadedFile(source, "image/jpeg"));
    const metadata = await sharp(Buffer.from(result.bytes)).metadata();

    expect(result.filename).toMatch(
      /^pmc-website-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/,
    );
    expect(result.filename).not.toContain("camera-original");
    expect(result.mimeType).toBe("image/jpeg");
    expect(metadata).toMatchObject({ format: "jpeg", width: 20, height: 40 });
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  });

  it("rejects content that does not match the declared MIME type", async () => {
    const png = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png().toBuffer();

    await expect(
      sanitizeImageUpload(uploadedFile(png, "image/jpeg")),
    ).rejects.toMatchObject({
      code: "INVALID_IMAGE_CONTENT",
      status: 415,
    });
  });

  it.each([
    ["image/png", "png", "png"],
    ["image/webp", "webp", "webp"],
    ["image/gif", "gif", "gif"],
  ] as const)("re-encodes %s uploads", async (mimeType, format, extension) => {
    const sourceImage = sharp({
      create: {
        width: 8,
        height: 6,
        channels: 4,
        background: { r: 100, g: 50, b: 20, alpha: 0.8 },
      },
    });
    const source = await (format === "png"
      ? sourceImage.png()
      : format === "webp"
        ? sourceImage.webp()
        : sourceImage.gif()
    ).toBuffer();

    const result = await sanitizeImageUpload(
      uploadedFile(source, mimeType, `private-name.${extension}`),
    );
    const metadata = await sharp(Buffer.from(result.bytes)).metadata();

    expect(result.filename).toMatch(
      new RegExp(`^pmc-website-[0-9a-f-]{36}\\.${extension}$`),
    );
    expect(result.mimeType).toBe(mimeType);
    expect(metadata.format).toBe(format);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  });

  it("rejects images whose decoded pixel count exceeds the configured limit", async () => {
    const png = await sharp({
      create: {
        width: 11,
        height: 10,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    }).png().toBuffer();
    process.env.MAX_IMAGE_INPUT_PIXELS = "100";

    await expect(
      sanitizeImageUpload(uploadedFile(png, "image/png")),
    ).rejects.toMatchObject({
      code: "IMAGE_DIMENSIONS_TOO_LARGE",
      status: 413,
    });
  });
});
