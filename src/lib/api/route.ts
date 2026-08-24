import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthRequiredError } from "@/lib/auth/session";
import { DirectusError } from "@/lib/directus/client";
import { CsrfError } from "@/lib/security/csrf";
import { AuthRateLimitError } from "@/lib/security/rate-limit";

export class ApiRouteError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export function dataResponse<T>(
  data: T,
  status = 200,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json({ data }, { status, headers });
}

function statusForDirectus(error: DirectusError): number {
  if ([400, 401, 403, 404, 409, 422, 429].includes(error.status)) return error.status;
  return 502;
}

export async function withRouteErrors(
  operation: () => Promise<Response>,
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    const headers = {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    };
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json({
        error: { code: error.code, message: error.message },
      }, {
        status: error.status,
        headers: { ...headers, "Retry-After": String(error.retryAfter) },
      });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          issues: error.flatten().fieldErrors,
        },
      }, { status: 400, headers });
    }
    if (error instanceof CsrfError || error instanceof ApiRouteError || error instanceof AuthRequiredError) {
      return NextResponse.json({
        error: { code: error.code, message: error.message },
      }, { status: error.status, headers });
    }
    if (error instanceof DirectusError) {
      return NextResponse.json({
        error: {
          code: error.status >= 500 ? "UPSTREAM_ERROR" : error.code,
          message: error.status >= 500 ? "The content service is unavailable" : error.message,
        },
      }, { status: statusForDirectus(error), headers });
    }
    console.error("Unhandled API route error", error);
    return NextResponse.json({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    }, { status: 500, headers });
  }
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiRouteError("Content-Type must be application/json", 415, "UNSUPPORTED_MEDIA_TYPE");
  }
  try {
    return await request.json();
  } catch {
    throw new ApiRouteError("Invalid JSON body");
  }
}
