import "server-only";

import { directusAssetUrl } from "@/lib/config";
import type { OrganizationAccountOption, OrganizationMember, OrganizationRole, OrganizationSection, SupporterTier } from "@/types";
import { DIRECTUS_APP_ENDPOINT } from "./constants";
import { directusRequest } from "./client";

interface OrganizationRaw {
  profile_id: string;
  user_id?: string | null;
  display_name: string;
  bio?: string | null;
  xbox_gamertag?: string | null;
  avatar?: string | null;
  role: OrganizationRole;
  team?: string | null;
  parent_id?: string | null;
  group_id?: string | null;
  highlighted?: boolean;
  supporterTier?: SupporterTier | null;
}

const roleLabels: Record<OrganizationRole, string> = {
  master: "マスター",
  administrator: "管理者",
  server_owner: "鯖主",
  team_member: "チームメンバー",
  trainee: "みならい",
};

export async function getOrganization(): Promise<OrganizationMember[]> {
  const response = await directusRequest<{ data: OrganizationRaw[] }>(`${DIRECTUS_APP_ENDPOINT}/organization`);
  return response.data.map((raw) => ({
    profileId: raw.profile_id,
    ...(raw.user_id ? { userId: raw.user_id } : {}),
    displayName: raw.display_name,
    ...(raw.avatar ? { avatarUrl: directusAssetUrl(raw.avatar) } : {}),
    bio: raw.bio ?? "",
    ...(raw.xbox_gamertag?.trim() ? { xboxGamertag: raw.xbox_gamertag.trim() } : {}),
    role: raw.role,
    roleLabel: roleLabels[raw.role],
    team: raw.team ?? "",
    ...(raw.parent_id ? { parentId: raw.parent_id } : {}),
    ...(raw.group_id ? { groupId: raw.group_id } : {}),
    highlighted: raw.highlighted === true,
    ...(raw.supporterTier ? { supporterTier: raw.supporterTier } : {}),
  }));
}

export async function getOrganizationLayout(): Promise<OrganizationSection[]> {
  const response = await directusRequest<{ data: OrganizationSection[] }>(`${DIRECTUS_APP_ENDPOINT}/organization/layout`);
  return response.data;
}

export async function updateOrganizationLayout(sections: OrganizationSection[], accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/organization/layout`, { method: "PUT", accessToken, body: { sections } });
}

export async function getOrganizationTeams(): Promise<string[]> {
  const response = await directusRequest<{ data: string[] }>(`${DIRECTUS_APP_ENDPOINT}/organization/teams`);
  return response.data;
}

export async function getOrganizationAccounts(accessToken: string): Promise<OrganizationAccountOption[]> {
  const response = await directusRequest<{ data: Array<{ id: string; email: string; display_name: string; organization_member_id?: string | null }> }>(`${DIRECTUS_APP_ENDPOINT}/organization/accounts`, { accessToken });
  return response.data.map((account) => ({
    id: account.id,
    displayName: account.display_name,
    email: account.email,
    ...(account.organization_member_id ? { organizationMemberId: account.organization_member_id } : {}),
  }));
}

export async function createOrganizationTeam(name: string, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/organization/teams`, {
    method: "POST",
    accessToken,
    body: { name },
  });
}

export async function renameOrganizationTeam(currentName: string, name: string, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/organization/teams/${encodeURIComponent(currentName)}`, {
    method: "PUT",
    accessToken,
    body: { name },
  });
}

export async function deleteOrganizationTeam(name: string, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/organization/teams/${encodeURIComponent(name)}`, {
    method: "DELETE",
    accessToken,
  });
}

export interface OrganizationUpdate {
  displayName: string;
  bio: string;
  xboxGamertag: string;
  userId: string | null;
  role: OrganizationRole;
  team: string;
  parentId: string | null;
  groupId: string | null;
}

interface OrganizationIdentityRaw {
  id: string;
  display_name?: string;
  bio?: string;
  xbox_gamertag?: string;
  avatar?: string | null;
}

export interface OrganizationIdentity {
  id: string;
  displayName: string;
  bio: string;
  xboxGamertag: string;
  avatarUrl?: string;
}

function organizationIdentity(raw: OrganizationIdentityRaw, fallback: OrganizationUpdate): OrganizationIdentity {
  return {
    id: raw.id,
    displayName: raw.display_name ?? fallback.displayName,
    bio: raw.bio ?? fallback.bio,
    xboxGamertag: raw.xbox_gamertag ?? fallback.xboxGamertag,
    ...(raw.avatar ? { avatarUrl: directusAssetUrl(raw.avatar) } : {}),
  };
}

export async function createOrganizationMember(input: OrganizationUpdate, accessToken: string): Promise<OrganizationIdentity> {
  const response = await directusRequest<{ data: OrganizationIdentityRaw }>(`${DIRECTUS_APP_ENDPOINT}/organization`, {
    method: "POST",
    accessToken,
    body: organizationBody(input),
  });
  return organizationIdentity(response.data, input);
}

function organizationBody(input: OrganizationUpdate) {
  return {
    display_name: input.displayName,
    bio: input.bio,
    xbox_gamertag: input.xboxGamertag,
    user_id: input.userId,
    role: input.role,
    team: input.team,
    parent_id: input.parentId,
    group_id: input.groupId,
  };
}

export async function updateOrganizationMember(profileId: string, input: OrganizationUpdate, accessToken: string): Promise<OrganizationIdentity> {
  const response = await directusRequest<{ data: OrganizationIdentityRaw }>(`${DIRECTUS_APP_ENDPOINT}/organization/${encodeURIComponent(profileId)}`, {
    method: "PUT",
    accessToken,
    body: organizationBody(input),
  });
  return organizationIdentity(response.data, input);
}

export async function deleteOrganizationMember(profileId: string, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/organization/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function updateOrganizationHighlight(profileId: string, enabled: boolean, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/organization/${encodeURIComponent(profileId)}/highlight`, {
    method: "PUT",
    accessToken,
    body: { enabled },
  });
}

export async function updateOrganizationSupporterTier(
  profileId: string,
  tier: SupporterTier | null,
  accessToken: string,
): Promise<{ supporterTier?: SupporterTier; highlighted: boolean }> {
  const response = await directusRequest<{ data: { supporterTier: SupporterTier | null; highlighted: boolean } }>(
    `${DIRECTUS_APP_ENDPOINT}/organization/${encodeURIComponent(profileId)}/supporter`,
    { method: "PUT", accessToken, body: { tier } },
  );
  return {
    ...(response.data.supporterTier ? { supporterTier: response.data.supporterTier } : {}),
    highlighted: response.data.highlighted,
  };
}
