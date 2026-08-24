import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/directus/files", () => ({ uploadImage: vi.fn(), assertStoredImages: vi.fn() }));

import { requireSession } from "@/lib/auth/session";
import { assertStoredImages, uploadImage } from "@/lib/directus/files";
import { POST } from "./route";

const fileId = "123e4567-e89b-42d3-a456-426614174000";

describe("POST /api/images", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3001";
    process.env.NEXT_PUBLIC_DIRECTUS_URL = "http://127.0.0.1:8056";
    vi.mocked(requireSession).mockReset().mockResolvedValue({
      accessToken: "token",
      user: { id: "user-id", displayName: "Member", isAdmin: false, tfaEnabled: false, email: "member@example.com" },
    });
    vi.mocked(uploadImage).mockReset().mockResolvedValue(fileId);
    vi.mocked(assertStoredImages).mockReset().mockResolvedValue(undefined);
  });

  it("uploads and returns a public asset URL", async () => {
    const form = new FormData();
    form.append("image", new File(["image"], "image.png", { type: "image/png" }));
    const request = new Request("http://localhost:3001/api/images", {
      method: "POST",
      headers: { Origin: "http://localhost:3001", "Content-Type": "multipart/form-data; boundary=test" },
    });
    vi.spyOn(request, "formData").mockResolvedValue(form);
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(uploadImage).toHaveBeenCalledOnce();
    expect(assertStoredImages).toHaveBeenCalledWith([fileId], "user-id", "token");
    await expect(response.json()).resolves.toEqual({
      data: { id: fileId, url: `http://127.0.0.1:8056/pmc-website/assets/${fileId}` },
    });
  });

  it("rejects non-multipart requests", async () => {
    const response = await POST(new Request("http://localhost:3001/api/images", {
      method: "POST",
      headers: { Origin: "http://localhost:3001", "Content-Type": "application/json" },
      body: "{}",
    }));
    expect(response.status).toBe(415);
    expect(uploadImage).not.toHaveBeenCalled();
  });
});
