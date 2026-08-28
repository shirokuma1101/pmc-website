import type { DirectusItemResponse } from "@/types/directus";
import { directusRequest } from "@/lib/directus/client";
import { DIRECTUS_APP_ENDPOINT } from "@/lib/directus/constants";

export interface MinecraftMapPathPoint { x: number; z: number }
export type MinecraftMapPathKind = "road" | "railway" | "other";

export interface MinecraftMapPath {
  id: string;
  name: string;
  description: string;
  world: string;
  kind: MinecraftMapPathKind;
  color: string;
  weight: number;
  dashed: boolean;
  points: MinecraftMapPathPoint[];
  author: { id: string; displayName: string };
  createdAt: string;
  updatedAt?: string;
}

export interface SaveMinecraftMapPath {
  name: string;
  description: string;
  world: string;
  kind: MinecraftMapPathKind;
  color: string;
  weight: number;
  dashed: boolean;
  points: MinecraftMapPathPoint[];
}

interface PathRaw extends Omit<MinecraftMapPath, "author" | "createdAt" | "updatedAt"> {
  author: { id: string; display_name: string };
  created_at: string;
  updated_at?: string | null;
}

function mapPath(raw: PathRaw): MinecraftMapPath {
  return {
    ...raw,
    weight: Number(raw.weight),
    dashed: Boolean(raw.dashed),
    points: raw.points.map((point) => ({ x: Number(point.x), z: Number(point.z) })),
    author: { id: raw.author.id, displayName: raw.author.display_name },
    createdAt: raw.created_at,
    ...(raw.updated_at ? { updatedAt: raw.updated_at } : {}),
  };
}

export async function getMapPaths(world?: string): Promise<MinecraftMapPath[]> {
  const response = await directusRequest<{ data: PathRaw[] }>(`${DIRECTUS_APP_ENDPOINT}/map-paths`, { query: { world } });
  return response.data.map(mapPath);
}

export async function createMapPath(input: SaveMinecraftMapPath, accessToken: string) {
  const response = await directusRequest<DirectusItemResponse<PathRaw>>(`${DIRECTUS_APP_ENDPOINT}/map-paths`, {
    method: "POST", body: { ...input }, accessToken,
  });
  return mapPath(response.data);
}

export async function updateMapPath(id: string, input: Partial<SaveMinecraftMapPath>, accessToken: string) {
  const response = await directusRequest<DirectusItemResponse<PathRaw>>(`${DIRECTUS_APP_ENDPOINT}/map-paths/${encodeURIComponent(id)}`, {
    method: "PATCH", body: input, accessToken,
  });
  return mapPath(response.data);
}

export async function deleteMapPath(id: string, accessToken: string) {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/map-paths/${encodeURIComponent(id)}`, {
    method: "DELETE", accessToken,
  });
}
