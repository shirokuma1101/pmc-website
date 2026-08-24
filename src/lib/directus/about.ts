import "server-only";

import type { AboutContent } from "@/lib/about";
import { defaultAboutContent } from "@/lib/about";
import type { DirectusItemResponse } from "@/types/directus";
import { directusRequest } from "./client";

function isAboutContent(value: unknown): value is AboutContent {
  if (!value || typeof value !== "object") return false;
  const content = value as Partial<AboutContent>;
  return typeof content.markdown === "string" && Boolean(content.markdown.trim());
}

export async function getAboutContent(accessToken?: string): Promise<AboutContent> {
  const response = await directusRequest<DirectusItemResponse<{ content?: unknown }>>(
    "/pmc-website/about",
    { accessToken },
  );
  return isAboutContent(response.data.content) ? response.data.content : defaultAboutContent;
}

export async function updateAboutContent(content: AboutContent, accessToken: string): Promise<void> {
  await directusRequest("/pmc-website/about", {
    method: "PUT",
    accessToken,
    body: { content },
  });
}
