import type { Profile } from "@/types";
import type { DirectusItemResponse, DirectusProfileRaw } from "@/types/directus";
import { DirectusError, directusRequest } from "./client";
import { DIRECTUS_APP_ENDPOINT } from "./constants";
import { mapProfile } from "./mappers";

export async function getProfile(id: string, accessToken?: string): Promise<Profile | null> {
  try {
    const response = await directusRequest<DirectusItemResponse<DirectusProfileRaw>>(
      `${DIRECTUS_APP_ENDPOINT}/profiles/${encodeURIComponent(id)}`,
      { accessToken },
    );
    return mapProfile(response.data);
  } catch (error) {
    if (error instanceof DirectusError && error.status === 404) return null;
    throw error;
  }
}

export async function getProfileByUserId(
  userId: string,
  accessToken?: string,
): Promise<Profile | null> {
  const response = await directusRequest<{ data: DirectusProfileRaw[] }>(
    `${DIRECTUS_APP_ENDPOINT}/profiles`,
    { accessToken, query: { user_id: userId } },
  );
  return response.data[0] ? mapProfile(response.data[0]) : null;
}

export interface SaveProfileInput {
  displayName: string;
  bio: string;
  avatarId?: string | null;
}

function profilePayload(input: Partial<SaveProfileInput>): Record<string, unknown> {
  return {
    ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.avatarId !== undefined ? { avatar: input.avatarId } : {}),
  };
}

export async function upsertMyProfile(
  userId: string,
  input: SaveProfileInput,
  accessToken: string,
): Promise<Profile> {
  void userId;
  const response = await directusRequest<DirectusItemResponse<{ id: string }>>(
    `${DIRECTUS_APP_ENDPOINT}/profile`,
    {
      method: "PUT",
      accessToken,
      body: profilePayload(input),
    },
  );
  const profile = await getProfile(response.data.id, accessToken);
  if (!profile) throw new DirectusError("Saved profile could not be read", 500);
  return profile;
}
