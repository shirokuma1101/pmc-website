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
  xboxGamertag?: string;
  avatarUrl?: string;
  user?: UserSummary;
  createdAt?: string;
  updatedAt?: string;
}

export type OrganizationRole = "master" | "administrator" | "server_owner" | "team_member" | "trainee";
export type OrganizationGroupColor = "blue" | "teal" | "gold" | "violet" | "rose" | "slate" | "green" | "cyan" | "indigo" | "orange" | "plum" | "red" | "olive" | "sky" | "brown" | "magenta";
export type SupporterTier = "supporter" | "basic" | "standard" | "premium";

export interface OrganizationMember {
  profileId: string;
  userId?: string;
  displayName: string;
  avatarUrl?: string;
  bio: string;
  xboxGamertag?: string;
  role: OrganizationRole;
  roleLabel: string;
  team: string;
  parentId?: string;
  groupId?: string;
  highlighted?: boolean;
  supporterTier?: SupporterTier;
}

export interface OrganizationGroup {
  id: string;
  label: string;
  caption: string;
  color?: OrganizationGroupColor;
}

export interface OrganizationSection {
  id: string;
  title: string;
  description: string;
  groups: OrganizationGroup[];
}

export interface OrganizationAccountOption {
  id: string;
  displayName: string;
  email: string;
  organizationMemberId?: string;
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

export interface ActivityRankingEntry {
  rank: number;
  user: UserSummary;
  activityExp: number;
}

export interface ActivityRanking {
  entries: ActivityRankingEntry[];
  since: string;
  until: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    issues?: Record<string, string[]>;
  };
}
