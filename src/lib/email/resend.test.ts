import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendJoinApplicationEmail, sendJoinDecisionEmail } from "./resend";

const input = {
  displayName: "<script>alert(1)</script>\r\nBcc: other@example.com",
  email: "join@example.com",
  minecraftGamertag: "PostMinePlayer",
  discordUsername: "postmine_user",
  motivation: "建築 & 探索をしたいです。",
};

describe("sendJoinApplicationEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "PostMineClan <no-reply@postmineclan.com>";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  it("sends only to the fixed support mailbox with an idempotency key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
    await expect(sendJoinApplicationEmail(input, "7e06c851-552d-45e7-8d3e-a8f07636213c")).resolves.toBe("email-id");

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.to).toEqual(["support@postmineclan.com"]);
    expect(body.reply_to).toBe("join@example.com");
    expect(body.html).not.toContain("<script>");
    expect(body.subject).not.toContain("\n");
    expect(body.subject).not.toContain("\r");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe("join-application/7e06c851-552d-45e7-8d3e-a8f07636213c");
  });

  it("fails closed when credentials are missing", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendJoinApplicationEmail(input, "7e06c851-552d-45e7-8d3e-a8f07636213c")).rejects.toMatchObject({ status: 503 });
  });

  it("sends an accepted decision only to the applicant", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "decision-email-id" }), { status: 200 }));
    await sendJoinDecisionEmail(input, "accepted", "Discordへご案内します。", "7e06c851-552d-45e7-8d3e-a8f07636213c");
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(options?.body));
    expect(body.to).toEqual(["join@example.com"]);
    expect(body.reply_to).toBe("support@postmineclan.com");
    expect(body.subject).toContain("承認");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toContain("/accepted");
  });
});
