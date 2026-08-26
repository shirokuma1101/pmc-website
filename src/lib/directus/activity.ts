import "server-only";

import { directusAssetUrl } from "@/lib/config";
import type { ActivityRanking } from "@/types";
import type { DirectusActivityRankingResponse } from "@/types/directus";
import { directusRequest } from "./client";

export async function getActivityRanking(): Promise<ActivityRanking> {
  const response = await directusRequest<DirectusActivityRankingResponse>(
    "/pmc-website/activity-ranking",
  );
  return {
    entries: response.data.map((entry) => ({
      rank: entry.rank,
      activityExp: entry.activity_exp,
      user: {
        id: entry.user.id,
        displayName: entry.user.display_name?.trim() || "Member",
        ...(entry.user.avatar ? { avatarUrl: directusAssetUrl(entry.user.avatar) } : {}),
      },
    })),
    since: response.meta.since,
    until: response.meta.until,
  };
}
