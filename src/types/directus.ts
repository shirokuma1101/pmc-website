import type { ArticleStatus } from "./index";

export interface DirectusFileRaw {
  id: string;
  title?: string | null;
  description?: string | null;
  filename_download?: string | null;
  folder?: string | { id: string } | null;
  type?: string | null;
  filesize?: string | number | null;
  uploaded_by?: string | DirectusUserRaw | null;
}

export interface DirectusRoleRaw {
  id: string;
  name?: string | null;
  policies?: DirectusPolicyLinkRaw[] | null;
}

export interface DirectusPolicyRaw {
  id: string;
  admin_access?: boolean | null;
  app_access?: boolean | null;
}

export interface DirectusPolicyLinkRaw {
  policy?: string | DirectusPolicyRaw | null;
}

export interface DirectusUserRaw {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | DirectusRoleRaw | null;
  policies?: DirectusPolicyLinkRaw[] | null;
  profile?: DirectusProfileRaw | DirectusProfileRaw[] | null;
}

export interface DirectusProfileRaw {
  id: string;
  user?: string | DirectusUserRaw | null;
  display_name?: string | null;
  bio?: string | null;
  xbox_gamertag?: string | null;
  avatar?: string | DirectusFileRaw | null;
  organization_role?: "master" | "administrator" | "server_owner" | "team_member" | "trainee" | null;
  organization_team?: string | null;
  organization_parent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DirectusPostFileRaw {
  id?: string | number;
  sort?: number | null;
  directus_files_id: string | DirectusFileRaw | null;
}

export interface DirectusPostRaw {
  id: string;
  author: string | DirectusUserRaw | null;
  content: string;
  files?: DirectusPostFileRaw[] | null;
  created_at: string;
  updated_at?: string | null;
  like_count?: number;
  liked_by_me?: boolean;
  can_like?: boolean;
}

export interface DirectusArticleRaw {
  id: string;
  author: string | DirectusUserRaw | null;
  title: string;
  slug: string;
  summary?: string | null;
  tags?: unknown;
  body?: string | null;
  thumbnail?: string | DirectusFileRaw | null;
  status: ArticleStatus;
  created_at: string;
  updated_at?: string | null;
  published_at?: string | null;
  review_comment?: string | null;
  like_count?: number;
  liked_by_me?: boolean;
  can_like?: boolean;
}

export interface DirectusArticleReviewRaw {
  id: string;
  article: string | { id: string };
  reviewer: string | DirectusUserRaw | null;
  action: "submitted" | "approved" | "rejected";
  comment?: string | null;
  created_at: string;
}

export interface DirectusListMeta {
  filter_count?: number;
  total_count?: number;
}

export interface DirectusListResponse<T> {
  data: T[];
  meta?: DirectusListMeta;
}

export interface DirectusItemResponse<T> {
  data: T;
}

export interface DirectusActivityRankingEntryRaw {
  rank: number;
  user: { id: string; display_name?: string | null; avatar?: string | null };
  activity_exp: number;
}

export interface DirectusActivityRankingResponse {
  data: DirectusActivityRankingEntryRaw[];
  meta: { since: string; until: string };
}

export interface DirectusSessionData {
  session_token: string;
  expires: number;
}

export interface DirectusSessionLoginResponse {
  data: { expires: number };
}

export interface DirectusJsonLoginResponse {
  data: {
    access_token: string;
    expires: number;
    refresh_token: string;
  };
}

export interface DirectusTwoFactorSetupResponse {
  data: {
    secret: string;
    otpauth_url: string;
  };
}
