import "server-only";

import { getDirectusUrl } from "@/lib/config";
import type {
  DirectusItemResponse,
  DirectusListResponse,
} from "@/types/directus";

type QueryValue = string | number | boolean | null | undefined;

export class DirectusError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "DIRECTUS_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DirectusError";
  }
}

export interface DirectusRequestOptions extends Omit<RequestInit, "body" | "headers"> {
  accessToken?: string;
  body?: BodyInit | Record<string, unknown>;
  headers?: HeadersInit;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${getDirectusUrl()}${normalizedPath}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function errorDetails(payload: unknown): { message?: string; code?: string } {
  if (!payload || typeof payload !== "object") return {};
  const errors = (payload as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || !errors[0] || typeof errors[0] !== "object") return {};
  const first = errors[0] as { message?: unknown; extensions?: { code?: unknown } };
  return {
    message: typeof first.message === "string" ? first.message : undefined,
    code: typeof first.extensions?.code === "string" ? first.extensions.code : undefined,
  };
}

export async function directusResponse(
  path: string,
  options: DirectusRequestOptions = {},
): Promise<Response> {
  const { accessToken, body, headers: inputHeaders, query, ...init } = options;
  const headers = new Headers(inputHeaders);
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let requestBody = body as BodyInit | undefined;
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...init,
      body: requestBody,
      headers,
      cache: init.cache ?? "no-store",
    });
  } catch (error) {
    throw new DirectusError("The content service could not be reached", 502, "UPSTREAM_UNAVAILABLE", error);
  }

  if (!response.ok) {
    const payload: unknown = await response.clone().json().catch(() => undefined);
    const parsed = errorDetails(payload);
    throw new DirectusError(
      parsed.message ?? `Directus request failed with ${response.status}`,
      response.status,
      parsed.code,
      payload,
    );
  }
  return response;
}

export async function directusRequest<T>(
  path: string,
  options: DirectusRequestOptions = {},
): Promise<T> {
  const response = await directusResponse(path, options);
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => undefined);
  return payload as T;
}

export function readItems<T>(
  collection: string,
  query: Record<string, QueryValue>,
  accessToken?: string,
): Promise<DirectusListResponse<T>> {
  return directusRequest(`/items/${collection}`, { query, accessToken });
}

export function readItem<T>(
  collection: string,
  id: string,
  query: Record<string, QueryValue>,
  accessToken?: string,
): Promise<DirectusItemResponse<T>> {
  return directusRequest(`/items/${collection}/${encodeURIComponent(id)}`, {
    query,
    accessToken,
  });
}
