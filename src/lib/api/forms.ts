import { ApiRouteError, readJson } from "./route";

export function isMultipart(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data");
}

export async function readObjectBody(request: Request): Promise<Record<string, unknown>> {
  const value = await readJson(request);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiRouteError("JSON body must be an object");
  }
  return value as Record<string, unknown>;
}

export function formString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

export function formStrings(form: FormData, key: string): string[] {
  return form.getAll(key).filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function formFiles(form: FormData, key: string): File[] {
  return form.getAll(key).filter((value): value is File => (
    typeof value !== "string" && value.size > 0 && value.name.length > 0
  ));
}
