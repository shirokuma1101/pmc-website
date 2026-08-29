import type { DirectusItemResponse } from "@/types/directus";
import { directusRequest } from "@/lib/directus/client";
import { DIRECTUS_APP_ENDPOINT } from "@/lib/directus/constants";
import { directusAssetUrl } from "@/lib/config";

export interface MinecraftMapMarker {
  id: string;
  name: string;
  description: string;
  world: string;
  x: number;
  y: number | null;
  z: number;
  icon: string;
  color: string;
  imageId: string | null;
  imageUrl?: string;
  relatedType: "post" | "article" | null;
  relatedId: string | null;
  relatedTitle?: string;
  relatedHref?: string;
  author: { id: string; displayName: string };
  createdAt: string;
  updatedAt?: string;
}

interface MarkerRaw extends Omit<MinecraftMapMarker, "author" | "createdAt" | "updatedAt" | "imageId" | "imageUrl" | "relatedType" | "relatedId" | "relatedTitle" | "relatedHref"> {
  author: { id: string; display_name: string };
  created_at: string;
  updated_at?: string | null;
  image?: string | null;
  related_type?: "post" | "article" | null;
  related_id?: string | null;
  related_title?: string | null;
  related_href?: string | null;
}

export interface SaveMinecraftMapMarker {
  name: string;
  description: string;
  world: string;
  x: number;
  y?: number | null;
  z: number;
  icon: string;
  color: string;
  imageId?: string | null;
  relatedType?: "post" | "article" | null;
  relatedId?: string | null;
}

interface MarkerMediaOptionRaw {
  key: string;
  image_id: string;
  related_type: "post" | "article";
  related_id: string;
  label: string;
  href: string;
}

export interface MarkerMediaOption {
  key: string;
  imageId: string;
  imageUrl: string;
  relatedType: "post" | "article";
  relatedId: string;
  label: string;
  href: string;
}

function mapMarker(raw: MarkerRaw): MinecraftMapMarker {
  return {
    id: raw.id, name: raw.name, description: raw.description, world: raw.world,
    x: Number(raw.x), y: raw.y === null ? null : Number(raw.y), z: Number(raw.z), icon: raw.icon,
    color: raw.color || "#d15d36",
    imageId: raw.image ?? null,
    ...(raw.image ? { imageUrl: directusAssetUrl(raw.image) } : {}),
    relatedType: raw.related_type ?? null,
    relatedId: raw.related_id ?? null,
    ...(raw.related_title ? { relatedTitle: raw.related_title } : {}),
    ...(raw.related_href ? { relatedHref: raw.related_href } : {}),
    author: { id: raw.author.id, displayName: raw.author.display_name }, createdAt: raw.created_at,
    ...(raw.updated_at ? { updatedAt: raw.updated_at } : {}),
  };
}

export async function getMapMarkers(world?: string): Promise<MinecraftMapMarker[]> {
  const response = await directusRequest<{ data: MarkerRaw[] }>(`${DIRECTUS_APP_ENDPOINT}/map-markers`, {
    query: { world },
  });
  return response.data.map(mapMarker);
}

export async function createMapMarker(input: SaveMinecraftMapMarker, accessToken: string) {
  const response = await directusRequest<DirectusItemResponse<MarkerRaw>>(`${DIRECTUS_APP_ENDPOINT}/map-markers`, {
    method: "POST", body: markerPayload(input), accessToken,
  });
  return mapMarker(response.data);
}

export async function updateMapMarker(id: string, input: Partial<SaveMinecraftMapMarker>, accessToken: string) {
  const response = await directusRequest<DirectusItemResponse<MarkerRaw>>(`${DIRECTUS_APP_ENDPOINT}/map-markers/${encodeURIComponent(id)}`, {
    method: "PATCH", body: markerPayload(input), accessToken,
  });
  return mapMarker(response.data);
}

function markerPayload(input: Partial<SaveMinecraftMapMarker>): Record<string, unknown> {
  const { imageId, relatedType, relatedId, ...fields } = input;
  return {
    ...fields,
    ...(imageId !== undefined ? { image: imageId } : {}),
    ...(relatedType !== undefined ? { related_type: relatedType } : {}),
    ...(relatedId !== undefined ? { related_id: relatedId } : {}),
  };
}

export async function deleteMapMarker(id: string, accessToken: string) {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/map-markers/${encodeURIComponent(id)}`, {
    method: "DELETE", accessToken,
  });
}

export async function getMarkerMediaOptions(accessToken: string): Promise<MarkerMediaOption[]> {
  const response = await directusRequest<{ data: MarkerMediaOptionRaw[] }>(
    `${DIRECTUS_APP_ENDPOINT}/map-marker-media-options`, { accessToken },
  );
  return response.data.map((option) => ({
    key: option.key,
    imageId: option.image_id,
    imageUrl: directusAssetUrl(option.image_id),
    relatedType: option.related_type,
    relatedId: option.related_id,
    label: option.label,
    href: option.href,
  }));
}
