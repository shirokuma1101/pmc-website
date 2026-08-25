export type ArticleStatus = "draft" | "pending" | "published" | "rejected";

export type ReviewAction = "approved" | "rejected";

export interface MediaAsset {
  id: string;
  url: string;
  alt?: string;
}

export interface UserSummary {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface Profile {
  id: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  user?: UserSummary;
  createdAt?: string;
  updatedAt?: string;
}

export interface Post {
  id: string;
  content: string;
  author: UserSummary;
  images?: MediaAsset[];
  createdAt: string;
  updatedAt?: string;
  likeCount: number;
  likedByMe: boolean;
  canLike: boolean;
}

export type ContentAuthorOption = UserSummary;
export type PostAuthorOption = ContentAuthorOption;
export type ArticleAuthorOption = ContentAuthorOption;

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  tags: string[];
  /** Markdown source. Embedded HTML must be sanitized when rendering this value. */
  body: string;
  thumbnailUrl?: string;
  status: ArticleStatus;
  author: UserSummary;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  reviewComment?: string;
  likeCount: number;
  likedByMe: boolean;
  canLike: boolean;
}

export interface ArticleReview {
  id: string;
  articleId: string;
  reviewer: UserSummary;
  action: "submitted" | ReviewAction;
  comment?: string;
  createdAt: string;
}

export interface SessionUser extends UserSummary {
  email?: string;
  roleId?: string;
  isAdmin: boolean;
  tfaEnabled: boolean;
}

export interface PublicSession {
  user: SessionUser;
}

export interface ServerSession extends PublicSession {
  /** Server-only bearer token. Never serialize a ServerSession into client props. */
  accessToken: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total?: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    issues?: Record<string, string[]>;
  };
}
