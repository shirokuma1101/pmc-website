import type { ContentAuthorOption } from "@/types";
import { directusAssetUrl } from "@/lib/config";
import { directusRequest } from "./client";
import { DIRECTUS_APP_ENDPOINT } from "./constants";

export async function getContentAuthors(accessToken: string): Promise<ContentAuthorOption[]> {
  const response = await directusRequest<{
    data: Array<{ id: string; display_name: string; avatar?: string | null }>;
  }>(`${DIRECTUS_APP_ENDPOINT}/admin/authors`, { accessToken });

  return response.data.map((author) => ({
    id: author.id,
    displayName: author.display_name,
    ...(author.avatar ? { avatarUrl: directusAssetUrl(author.avatar) } : {}),
  }));
}
