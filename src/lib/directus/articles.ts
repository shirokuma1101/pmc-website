import type {
  Article,
  ArticleReview,
  ArticleStatus,
  PaginatedResult,
  ReviewAction,
} from "@/types";
import type {
  DirectusArticleRaw,
  DirectusArticleReviewRaw,
  DirectusItemResponse,
} from "@/types/directus";
import { DirectusError, directusRequest } from "./client";
import { DIRECTUS_APP_ENDPOINT } from "./constants";
import { mapArticle, mapUserSummary } from "./mappers";
import { paginated } from "./pagination";

interface PageOptions {
  page?: number;
  limit?: number;
}

export interface PublishedArticleOptions extends PageOptions {
  authorId?: string;
  tag?: string;
  accessToken?: string;
}

async function listArticles(
  scope: "published" | "own" | "pending",
  options: PageOptions,
  accessToken?: string,
  extraQuery: Record<string, string | undefined> = {},
): Promise<PaginatedResult<Article>> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 12));
  const response = await directusRequest<{
    data: DirectusArticleRaw[];
    meta?: { filter_count?: number };
  }>(`${DIRECTUS_APP_ENDPOINT}/articles`, {
    accessToken,
    query: {
      scope,
      ...extraQuery,
      page,
      limit,
    },
  });
  return paginated(response.data.map(mapArticle), page, limit, response.meta);
}

export function getPublishedArticles(
  options: PublishedArticleOptions = {},
): Promise<PaginatedResult<Article>> {
  return listArticles(
    "published",
    options,
    options.accessToken,
    { author_id: options.authorId, tag: options.tag },
  );
}

export async function getPublishedArticleTags(): Promise<string[]> {
  const response = await directusRequest<{ data: string[] }>(`${DIRECTUS_APP_ENDPOINT}/articles/tags`);
  return response.data;
}

export async function getArticleBySlug(slug: string, accessToken?: string): Promise<Article | null> {
  try {
    const response = await directusRequest<DirectusItemResponse<DirectusArticleRaw>>(
      `${DIRECTUS_APP_ENDPOINT}/articles/by-slug/${encodeURIComponent(slug)}`,
      { accessToken },
    );
    return mapArticle(response.data);
  } catch (error) {
    if (error instanceof DirectusError && error.status === 404) return null;
    throw error;
  }
}

export async function getArticleById(id: string, accessToken?: string): Promise<Article | null> {
  try {
    const response = await directusRequest<DirectusItemResponse<DirectusArticleRaw>>(
      `${DIRECTUS_APP_ENDPOINT}/articles/${encodeURIComponent(id)}`,
      { accessToken },
    );
    return mapArticle(response.data);
  } catch (error) {
    if (error instanceof DirectusError && error.status === 404) return null;
    throw error;
  }
}

export function getOwnArticles(
  userId: string,
  accessToken: string,
  options: PageOptions & { status?: ArticleStatus } = {},
): Promise<PaginatedResult<Article>> {
  void userId;
  return listArticles("own", options, accessToken, { status: options.status });
}

export function getPendingArticles(
  accessToken: string,
  options: PageOptions = {},
): Promise<PaginatedResult<Article>> {
  return listArticles("pending", options, accessToken);
}

export async function getArticleReviews(
  articleId: string,
  accessToken: string,
): Promise<ArticleReview[]> {
  const response = await directusRequest<{ data: DirectusArticleReviewRaw[] }>(
    `${DIRECTUS_APP_ENDPOINT}/articles/${encodeURIComponent(articleId)}/reviews`,
    { accessToken },
  );
  return response.data.map((raw) => ({
    id: raw.id,
    articleId: typeof raw.article === "string" ? raw.article : raw.article.id,
    reviewer: mapUserSummary(raw.reviewer),
    action: raw.action,
    ...(raw.comment ? { comment: raw.comment } : {}),
    createdAt: raw.created_at,
  }));
}

export interface SaveArticleInput {
  title: string;
  slug: string;
  summary: string;
  tags: string[];
  body: string;
}

function articlePayload(input: Partial<SaveArticleInput>): Record<string, unknown> {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.summary !== undefined ? { summary: input.summary } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
  };
}

export async function createArticle(
  input: SaveArticleInput,
  accessToken: string,
  explicitAuthorId?: string,
): Promise<Article> {
  // Kept for call-site compatibility; the endpoint always derives the author
  // from the authenticated Directus session, including for administrators.
  void explicitAuthorId;
  const created = await directusRequest<DirectusItemResponse<{ id: string }>>(`${DIRECTUS_APP_ENDPOINT}/articles`, {
    method: "POST",
    accessToken,
    body: articlePayload(input),
  });
  const article = await getArticleById(created.data.id, accessToken);
  if (!article) throw new DirectusError("Created article could not be read", 500);
  return article;
}

/** Article edits deliberately never include status, author or published_at. */
export async function updateArticle(
  id: string,
  input: Partial<SaveArticleInput>,
  accessToken: string,
): Promise<Article> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/articles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken,
    body: articlePayload(input),
  });
  const article = await getArticleById(id, accessToken);
  if (!article) throw new DirectusError("Updated article could not be read", 500);
  return article;
}

export async function deleteArticle(id: string, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/articles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function setArticleLike(id: string, liked: boolean, accessToken: string): Promise<number> {
  const response = await directusRequest<DirectusItemResponse<{ like_count: number }>>(
    `${DIRECTUS_APP_ENDPOINT}/articles/${encodeURIComponent(id)}/like`,
    { method: liked ? "POST" : "DELETE", accessToken },
  );
  return response.data.like_count;
}

export async function submitArticle(id: string, accessToken: string): Promise<Article> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/articles/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    accessToken,
  });
  const article = await getArticleById(id, accessToken);
  if (!article) throw new DirectusError("Submitted article could not be read", 500);
  return article;
}

export async function reviewArticle(
  id: string,
  input: { action: ReviewAction; comment?: string },
  accessToken: string,
): Promise<Article> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/articles/${encodeURIComponent(id)}/review`, {
    method: "POST",
    accessToken,
    body: {
      action: input.action === "approved" ? "approve" : "reject",
      ...(input.comment ? { comment: input.comment } : {}),
    },
  });
  const article = await getArticleById(id, accessToken);
  if (!article) throw new DirectusError("Reviewed article could not be read", 500);
  return article;
}
