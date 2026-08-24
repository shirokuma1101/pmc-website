import type { PaginatedResult } from "@/types";
import type { DirectusListMeta } from "@/types/directus";

export function paginated<T>(
  data: T[],
  page: number,
  limit: number,
  meta?: DirectusListMeta,
): PaginatedResult<T> {
  const total = meta?.filter_count ?? meta?.total_count;
  return {
    data,
    pagination: {
      page,
      limit,
      ...(typeof total === "number" ? { total } : {}),
      hasMore: typeof total === "number" ? page * limit < total : data.length === limit,
    },
  };
}
