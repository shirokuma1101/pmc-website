import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./navigation";

describe("safeInternalPath", () => {
  it("keeps a normalized same-origin path", () => {
    expect(safeInternalPath("/articles?page=2#latest")).toBe(
      "/articles?page=2#latest",
    );
  });

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "/%5cevil.example/",
    "/%2f%2fevil.example/",
    "/\u0000evil.example/",
  ])("rejects an unsafe redirect target: %s", (target) => {
    expect(safeInternalPath(target)).toBe("/timeline");
  });

  it("uses the first scalar value and supports a custom fallback", () => {
    expect(safeInternalPath(["/me", "/admin"], "/")).toBe("/me");
    expect(safeInternalPath(undefined, "/")).toBe("/");
  });
});
