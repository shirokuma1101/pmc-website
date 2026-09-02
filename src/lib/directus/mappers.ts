import { directusAssetUrl } from "@/lib/config";
import type { Article, MediaAsset, Post, Profile, SessionUser, UserSummary } from "@/types";
import type {
  DirectusArticleRaw,
  DirectusFileRaw,
  DirectusPostRaw,
  DirectusProfileRaw,
  DirectusUserRaw,
} from "@/types/directus";

function fileId(file: string | DirectusFileRaw | null | undefined): string | undefined {
  return typeof file === "string" ? file : file?.id;
}

function firstProfile(user: DirectusUserRaw): DirectusProfileRaw | undefined {
  return (Array.isArray(user.profile) ? user.profile[0] : user.profile)
    ?? undefined;
}

export function mapUserSummary(
  user: string | DirectusUserRaw | null | undefined,
): UserSummary {
  if (!user) return { id: "unknown", displayName: "Member" };
  if (typeof user === "string") return { id: user, displayName: "Member" };
  const profile = firstProfile(user);
  const name = profile?.display_name?.trim()
    || [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    || "Member";
  const avatar = fileId(profile?.avatar);
  return {
    id: user.id,
    displayName: name,
    ...(avatar ? { avatarUrl: directusAssetUrl(avatar) } : {}),
  };
}

export function mapSessionUser(user: DirectusUserRaw): SessionUser {
  const summary = mapUserSummary(user);
  const role = typeof user.role === "object" && user.role ? user.role : undefined;
  const roleId = typeof user.role === "string" ? user.role : role?.id;
  const policyIsAdmin = (link: NonNullable<DirectusUserRaw["policies"]>[number]) =>
    typeof link.policy === "object" && link.policy?.admin_access === true;
  const isAdmin = Boolean(
    role?.policies?.some(policyIsAdmin)
      || user.policies?.some(policyIsAdmin),
  );
  return {
    ...summary,
    ...(user.email ? { email: user.email } : {}),
    ...(roleId ? { roleId } : {}),
    isAdmin,
    tfaEnabled: false,
  };
}

export function mapProfile(raw: DirectusProfileRaw): Profile {
  const avatar = fileId(raw.avatar);
  const minecraftSkin = fileId(raw.minecraft_skin);
  const user = raw.user ? mapUserSummary(raw.user) : undefined;
  return {
    id: raw.id,
    displayName: raw.display_name?.trim() || user?.displayName || "Member",
    bio: raw.bio ?? "",
    ...(raw.xbox_gamertag?.trim() ? { xboxGamertag: raw.xbox_gamertag.trim() } : {}),
    ...(avatar ? { avatarUrl: directusAssetUrl(avatar) } : {}),
    ...(minecraftSkin ? { minecraftSkinUrl: directusAssetUrl(minecraftSkin) } : {}),
    ...(raw.minecraft_skin_model ? { minecraftSkinModel: raw.minecraft_skin_model } : {}),
    ...(user ? { user } : {}),
    ...(raw.created_at ? { createdAt: raw.created_at } : {}),
    ...(raw.updated_at ? { updatedAt: raw.updated_at } : {}),
  };
}

export function mapPost(raw: DirectusPostRaw): Post {
  const images: MediaAsset[] = (raw.files ?? [])
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((relation) => relation.directus_files_id)
    .filter((file): file is string | DirectusFileRaw => file !== null)
    .map((file) => {
      const id = typeof file === "string" ? file : file.id;
      const alt = typeof file === "string" ? undefined : file.description || undefined;
      return { id, url: directusAssetUrl(id), ...(alt ? { alt } : {}) };
    });
  return {
    id: raw.id,
    content: raw.content,
    author: mapUserSummary(raw.author),
    ...(images.length ? { images } : {}),
    createdAt: raw.created_at,
    ...(raw.updated_at ? { updatedAt: raw.updated_at } : {}),
    likeCount: raw.like_count ?? 0,
    likedByMe: raw.liked_by_me ?? false,
    canLike: raw.can_like ?? false,
  };
}

export function mapArticle(raw: DirectusArticleRaw): Article {
  const thumbnail = fileId(raw.thumbnail);
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    summary: raw.summary ?? "",
    tags,
    body: raw.body ?? "",
    ...(thumbnail ? { thumbnailUrl: directusAssetUrl(thumbnail) } : {}),
    status: raw.status,
    author: mapUserSummary(raw.author),
    createdAt: raw.created_at,
    ...(raw.updated_at ? { updatedAt: raw.updated_at } : {}),
    ...(raw.published_at ? { publishedAt: raw.published_at } : {}),
    ...(raw.review_comment ? { reviewComment: raw.review_comment } : {}),
    likeCount: raw.like_count ?? 0,
    likedByMe: raw.liked_by_me ?? false,
    canLike: raw.can_like ?? false,
  };
}
