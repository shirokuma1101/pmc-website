import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ directusRequest: vi.fn().mockResolvedValue({ data: {} }) }));

import { directusRequest } from "./client";
import { createJoinApplication } from "./join-applications";

describe("createJoinApplication", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.PMC_INTERNAL_API_TOKEN;
  });

  it("forwards only fields supported by the Directus endpoint", async () => {
    process.env.PMC_INTERNAL_API_TOKEN = "internal-test-token";
    await createJoinApplication({
      submissionId: "7e06c851-552d-45e7-8d3e-a8f07636213c",
      displayName: "しろくま",
      email: "join@example.com",
      minecraftGamertag: "PostMinePlayer",
      discordUsername: "postmine_user",
      motivation: "参加したいです。",
      ageRequirement: true,
    } as Parameters<typeof createJoinApplication>[0] & { ageRequirement: boolean });

    expect(directusRequest).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      body: {
        id: "7e06c851-552d-45e7-8d3e-a8f07636213c",
        displayName: "しろくま",
        email: "join@example.com",
        minecraftGamertag: "PostMinePlayer",
        discordUsername: "postmine_user",
        motivation: "参加したいです。",
      },
    }));
  });
});
