import { beforeEach, describe, expect, it } from "vitest";
import type {
  DirectusArticleRaw,
  DirectusPostRaw,
  DirectusProfileRaw,
  DirectusUserRaw,
} from "@/types/directus";
import { mapArticle, mapPost, mapProfile, mapSessionUser, mapUserSummary } from "./mappers";

beforeEach(() => {
  process.env.NEXT_PUBLIC_DIRECTUS_URL = "https://cms.example.com/";
});

describe("Directus domain mappers", () => {
  it("publishes only the profile display name and sanitized asset URL", () => {
    const user = {
      id: "user-1",
      email: "private@example.com",
      first_name: "Private",
      last_name: "Name",
      profile: [{ id: "profile-1", display_name: " Public Name ", avatar: { id: "avatar id" } }],
    } as DirectusUserRaw;

    expect(mapUserSummary(user)).toEqual({
      id: "user-1",
      displayName: "Public Name",
      avatarUrl: "https://cms.example.com/pmc-website/assets/avatar%20id",
    });
  });

  it("derives administrator authority only from an admin policy", () => {
    const member = mapSessionUser({ id: "member", role: { id: "role", policies: [] } } as DirectusUserRaw);
    const admin = mapSessionUser({
      id: "admin",
      role: { id: "role", policies: [{ policy: { admin_access: true } }] },
    } as DirectusUserRaw);

    expect(member.isAdmin).toBe(false);
    expect(admin.isAdmin).toBe(true);
    expect(admin.roleId).toBe("role");
  });

  it("maps nullable profile relations without crashing", () => {
    expect(mapProfile({ id: "profile", display_name: "", bio: null, user: null } as DirectusProfileRaw)).toEqual({
      id: "profile",
      displayName: "Member",
      bio: "",
    });
  });

  it("sorts post images and supplies safe like defaults", () => {
    const post = mapPost({
      id: "post",
      content: "activity",
      author: null,
      created_at: "2026-08-23T00:00:00Z",
      files: [
        { id: 2, sort: 2, directus_files_id: { id: "second", description: "Second" } },
        { id: 1, sort: 1, directus_files_id: "first" },
        { id: 3, sort: 3, directus_files_id: null },
      ],
    } as DirectusPostRaw);

    expect(post.images?.map((image) => image.id)).toEqual(["first", "second"]);
    expect(post.images?.[1]?.alt).toBe("Second");
    expect(post.likeCount).toBe(0);
    expect(post.likedByMe).toBe(false);
    expect(post.canLike).toBe(false);
  });

  it("filters malformed article tags and maps publication fields", () => {
    const article = mapArticle({
      id: "article",
      title: "Title",
      slug: "title",
      summary: null,
      tags: ["Minecraft", 42, null],
      body: null,
      thumbnail: "thumbnail",
      status: "published",
      author: "user-1",
      created_at: "2026-08-23T00:00:00Z",
      published_at: "2026-08-23T01:00:00Z",
    } as DirectusArticleRaw);

    expect(article.tags).toEqual(["Minecraft"]);
    expect(article.body).toBe("");
    expect(article.summary).toBe("");
    expect(article.thumbnailUrl).toBe("https://cms.example.com/pmc-website/assets/thumbnail");
    expect(article.publishedAt).toBe("2026-08-23T01:00:00Z");
  });
});
