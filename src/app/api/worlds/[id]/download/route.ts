import { withRouteErrors } from "@/lib/api/route";
import { requireSession } from "@/lib/auth/session";
import { downloadWorld } from "@/lib/directus/worlds";
import { idSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withRouteErrors(async () => {
    const session = await requireSession();
    const { id } = await context.params;
    const upstream = await downloadWorld(idSchema.parse(id), session.accessToken);
    const headers = new Headers();
    for (const name of ["content-type", "content-length", "content-disposition", "x-content-type-options"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "private, no-store");
    headers.set("Vary", "Cookie");
    return new Response(upstream.body, { status: upstream.status, headers });
  });
}
