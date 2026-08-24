type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export async function getApiErrorMessage(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) return fallback;

  const nestedError = body.error;
  if (isRecord(nestedError) && typeof nestedError.message === "string") {
    return nestedError.message;
  }
  if (typeof body.message === "string") return body.message;
  if (typeof nestedError === "string") return nestedError;
  return fallback;
}

export function unwrapApiData<T>(payload: unknown, namedKey?: string): T | null {
  if (payload === null || payload === undefined) return null;
  if (!isRecord(payload)) return payload as T;
  if ("data" in payload) return (payload.data ?? null) as T | null;
  if (namedKey && namedKey in payload) return (payload[namedKey] ?? null) as T | null;
  return payload as T;
}
