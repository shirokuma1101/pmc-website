import "server-only";

import type { DirectusItemResponse } from "@/types/directus";
import { defaultWorldsContent } from "@/lib/worlds";
import type { WorldDownload, WorldsContent, WorldsPageData } from "@/lib/worlds";
import { DIRECTUS_APP_ENDPOINT } from "./constants";
import { directusRequest, directusResponse } from "./client";

interface WorldsRaw {
  content?: unknown;
  files?: Array<{
    id?: unknown;
    filename_download?: unknown;
    description?: unknown;
    uploaded_on?: unknown;
  }>;
}

function content(value: unknown): WorldsContent {
  if (!value || typeof value !== "object") return defaultWorldsContent;
  const markdown = (value as { markdown?: unknown }).markdown;
  return typeof markdown === "string" && markdown.trim() ? { markdown } : defaultWorldsContent;
}

function file(value: NonNullable<WorldsRaw["files"]>[number]): WorldDownload | null {
  if (typeof value.id !== "string" || typeof value.filename_download !== "string") return null;
  return {
    id: value.id,
    filename: value.filename_download,
    description: typeof value.description === "string" ? value.description : "",
    uploadedAt: typeof value.uploaded_on === "string" ? value.uploaded_on : "",
  };
}

export async function getWorldsPage(accessToken: string): Promise<WorldsPageData> {
  const response = await directusRequest<DirectusItemResponse<WorldsRaw>>(
    `${DIRECTUS_APP_ENDPOINT}/worlds`,
    { accessToken },
  );
  return {
    content: content(response.data.content),
    files: (response.data.files ?? []).map(file).filter((item): item is WorldDownload => item !== null),
  };
}

export async function updateWorldsContent(content: WorldsContent, accessToken: string): Promise<void> {
  await directusRequest(`${DIRECTUS_APP_ENDPOINT}/worlds`, {
    method: "PUT",
    accessToken,
    body: { content },
  });
}

export function downloadWorld(id: string, accessToken: string): Promise<Response> {
  return directusResponse(`${DIRECTUS_APP_ENDPOINT}/worlds/${encodeURIComponent(id)}/download`, {
    accessToken,
    headers: { Accept: "application/octet-stream" },
  });
}
