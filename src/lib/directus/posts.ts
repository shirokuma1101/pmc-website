import type { PaginatedResult, Post, PostAuthorOption } from "@/types";
import type { DirectusItemResponse, DirectusPostRaw } from "@/types/directus";
import { directusAssetUrl } from "@/lib/config";
import { directusRequest } from "./client";
import { DIRECTUS_APP_ENDPOINT } from "./constants";
import { mapPost } from "./mappers";
import { paginated } from "./pagination";

export interface GetPostsOptions {
  page?: number;
  limit?: number;
  authorId?: string;
  accessToken?: string;
}

export async function getPosts(options: GetPostsOptions = {}): Promise<PaginatedResult<Post>> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const response = await directusRequest<{
    data: DirectusPostRaw[];
    meta?: { filter_count?: number };
  }>(`${DIRECTUS_APP_ENDPOINT}/posts`, {
    accessToken: options.accessToken,
    query: {
      limit,
      page,
      author_id: options.authorId,
    },
  });
  return paginated(response.data.map(mapPost), page, limit, response.meta);
}

export async function getPost(id: string, accessToken?: string): Promise<Post> {
  const response = await directusRequest<DirectusItemResponse<DirectusPostRaw>>(
    `${DIRECTUS_APP_ENDPOINT}/posts/${encodeURIComponent(id)}`,
    { accessToken },
  );
  return mapPost(response.data);
}

export interface SavePostInput {
  content: string;
  fileIds?: string[];
  authorId?: string;
  createdAt?: string;
}

export async function createPost(input: SavePostInput, accessToken: string): Promise<Post> {
  const created = await directusRequest<DirectusItemResponse<{ id: string }>>(`${DIRECTUS_APP_ENDPOINT}/posts`, {
    method: "POST",
    accessToken,
    body: {
      content: input.content,
      file_ids: input.fileIds ?? [],
      ...(input.authorId !== undefined ? { author_id: input.authorId } : {}),
      ...(input.createdAt !== undefined ? { created_at: input.createdAt } : {}),
    },
  });
  return getPost(created.data.id, accessToken);
}

export async function updatePost(
  id: string,
  input: Partial<SavePostInput>,
  accessToken: string,
): Promise<Post> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken,
    body: {
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.fileIds !== undefined ? { file_ids: input.fileIds } : {}),
      ...(input.authorId !== undefined ? { author_id: input.authorId } : {}),
      ...(input.createdAt !== undefined ? { created_at: input.createdAt } : {}),
    },
  });
  return getPost(id, accessToken);
}

export async function getPostAuthors(accessToken: string): Promise<PostAuthorOption[]> {
  const response = await directusRequest<{ data: Array<{ id: string; display_name: string; avatar?: string | null }> }>(
    `${DIRECTUS_APP_ENDPOINT}/admin/post-authors`,
    { accessToken },
  );
  return response.data.map((author) => ({
    id: author.id,
    displayName: author.display_name,
    ...(author.avatar ? { avatarUrl: directusAssetUrl(author.avatar) } : {}),
  }));
}

export async function deletePost(id: string, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function setPostLike(id: string, liked: boolean, accessToken: string): Promise<number> {
  const response = await directusRequest<DirectusItemResponse<{ like_count: number }>>(
    `${DIRECTUS_APP_ENDPOINT}/posts/${encodeURIComponent(id)}/like`,
    { method: liked ? "POST" : "DELETE", accessToken },
  );
  return response.data.like_count;
}
