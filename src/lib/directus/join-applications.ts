import "server-only";

import { directusRequest } from "./client";
import { DIRECTUS_APP_ENDPOINT } from "./constants";

export type JoinApplicationStatus = "pending" | "accepted" | "rejected";

export interface StoredJoinApplication {
  id: string;
  displayName: string;
  email: string;
  minecraftGamertag: string;
  discordUsername: string;
  motivation: string;
  status: JoinApplicationStatus;
  decisionMessage: string | null;
  createdAt: string;
  decidedAt: string | null;
}

interface RawJoinApplication {
  id: string;
  display_name: string;
  email: string;
  minecraft_gamertag: string;
  discord_username: string;
  motivation: string;
  status: JoinApplicationStatus;
  decision_message: string | null;
  created_at: string;
  decided_at: string | null;
}

function mapApplication(item: RawJoinApplication): StoredJoinApplication {
  return {
    id: item.id,
    displayName: item.display_name,
    email: item.email,
    minecraftGamertag: item.minecraft_gamertag,
    discordUsername: item.discord_username,
    motivation: item.motivation,
    status: item.status,
    decisionMessage: item.decision_message,
    createdAt: item.created_at,
    decidedAt: item.decided_at,
  };
}

export async function createJoinApplication(input: {
  submissionId: string;
  displayName: string;
  email: string;
  minecraftGamertag: string;
  discordUsername: string;
  motivation: string;
}): Promise<void> {
  const internalToken = process.env.PMC_INTERNAL_API_TOKEN;
  if (!internalToken) throw new Error("PMC_INTERNAL_API_TOKEN is not configured");
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/join-applications`, {
    method: "POST",
    body: {
      id: input.submissionId,
      displayName: input.displayName,
      email: input.email,
      minecraftGamertag: input.minecraftGamertag,
      discordUsername: input.discordUsername,
      motivation: input.motivation,
    },
    headers: { "X-PMC-Internal-Token": internalToken },
  });
}

export async function getJoinApplications(accessToken: string): Promise<StoredJoinApplication[]> {
  const response = await directusRequest<{ data: RawJoinApplication[] }>(`${DIRECTUS_APP_ENDPOINT}/join-applications`, { accessToken });
  return response.data.map(mapApplication);
}

export async function getJoinApplication(id: string, accessToken: string): Promise<StoredJoinApplication> {
  const response = await directusRequest<{ data: RawJoinApplication }>(
    `${DIRECTUS_APP_ENDPOINT}/join-applications/${encodeURIComponent(id)}`,
    { accessToken },
  );
  return mapApplication(response.data);
}

export async function decideJoinApplication(
  id: string,
  status: Exclude<JoinApplicationStatus, "pending">,
  message: string,
  accessToken: string,
): Promise<StoredJoinApplication> {
  const response = await directusRequest<{ data: RawJoinApplication }>(
    `${DIRECTUS_APP_ENDPOINT}/join-applications/${encodeURIComponent(id)}/decision`,
    { method: "POST", accessToken, body: { status, message } },
  );
  return mapApplication(response.data);
}
