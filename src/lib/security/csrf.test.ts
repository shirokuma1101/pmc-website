import { describe, expect, it } from "vitest";
import { assertSameOrigin, CsrfError } from "./csrf";

describe("assertSameOrigin", () => {
  it("accepts a same-origin mutation", () => {
    const request = new Request("https://pmc-website.test/api/posts", {
      method: "POST",
      headers: { origin: "https://pmc-website.test", "sec-fetch-site": "same-origin" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects missing and cross-origin origins", () => {
    const missing = new Request("https://pmc-website.test/api/posts", { method: "POST" });
    const crossOrigin = new Request("https://pmc-website.test/api/posts", {
      method: "POST",
      headers: { origin: "https://attacker.test", "sec-fetch-site": "cross-site" },
    });
    expect(() => assertSameOrigin(missing)).toThrow(CsrfError);
    expect(() => assertSameOrigin(crossOrigin)).toThrow(CsrfError);
  });
});
