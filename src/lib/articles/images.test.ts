import { describe, expect, it } from "vitest";
import { newlyReferencedImageIds, storedImageIdsInMarkdown } from "./images";

describe("storedImageIdsInMarkdown", () => {
  it("extracts and deduplicates PostMineClan asset IDs", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(storedImageIdsInMarkdown(
      `![画像](https://cms.example.com/pmc-website/assets/${id})\n![再掲](/pmc-website/assets/${id})`,
    )).toEqual([id]);
  });

  it("ignores external images and malformed IDs", () => {
    expect(storedImageIdsInMarkdown(
      "![外部](https://example.com/image.webp) ![不正](/pmc-website/assets/not-an-id)",
    )).toEqual([]);
  });

  it("preserves image order so the first image can be used as the thumbnail", () => {
    const first = "123e4567-e89b-42d3-a456-426614174000";
    const second = "223e4567-e89b-42d3-a456-426614174001";
    expect(storedImageIdsInMarkdown(
      `![先頭](/pmc-website/assets/${first})\n![2枚目](/pmc-website/assets/${second})`,
    )).toEqual([first, second]);
  });
});

describe("newlyReferencedImageIds", () => {
  it("allows images already attached to an article after its author changes", () => {
    const existingId = "123e4567-e89b-42d3-a456-426614174000";
    const addedId = "123e4567-e89b-42d3-a456-426614174001";
    expect(newlyReferencedImageIds(
      `![既存](https://cms.example.com/pmc-website/assets/${existingId})`,
      `![既存](https://cms.example.com/pmc-website/assets/${existingId})\n![追加](https://cms.example.com/pmc-website/assets/${addedId})`,
    )).toEqual([addedId]);
  });
});
