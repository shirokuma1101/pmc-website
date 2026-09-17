import { NextResponse } from "next/server";
import { readJson, withRouteErrors } from "@/lib/api/route";
import { requireAdminSession } from "@/lib/auth/session";
import { decideJoinApplication, getJoinApplication } from "@/lib/directus/join-applications";
import { sendJoinDecisionEmail } from "@/lib/email/resend";
import { assertSameOrigin } from "@/lib/security/csrf";
import { idSchema, joinDecisionSchema } from "@/lib/validation/schemas";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  return withRouteErrors(async () => {
    assertSameOrigin(request);
    const session = await requireAdminSession();
    const id = idSchema.parse((await context.params).id);
    const input = joinDecisionSchema.parse(await readJson(request));
    const application = await getJoinApplication(id, session.accessToken);
    if (application.status !== "pending") {
      return NextResponse.json({ error: { code: "APPLICATION_ALREADY_DECIDED", message: "この申請は判定済みです。" } }, { status: 409 });
    }
    await sendJoinDecisionEmail(application, input.status, input.message, id);
    await decideJoinApplication(id, input.status, input.message, session.accessToken);
    return NextResponse.json({ data: { decided: true } });
  });
}
