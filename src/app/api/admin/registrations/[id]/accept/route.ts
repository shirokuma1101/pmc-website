import { NextResponse } from "next/server";
import { withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { acceptRegistration } from "@/lib/directus/registrations";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema } from "@/lib/validation/schemas";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const id = idSchema.parse((await context.params).id);
    await acceptRegistration(id, session.accessToken);
    return new NextResponse(null, { status: 204 });
  });
}
