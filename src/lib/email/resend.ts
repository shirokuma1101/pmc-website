import "server-only";

import { ApiRouteError } from "@/lib/api/route";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const JOIN_APPLICATION_RECIPIENT = "support@postmineclan.com";

export interface JoinApplicationEmail {
  displayName: string;
  email: string;
  minecraftGamertag: string;
  discordUsername: string;
  motivation: string;
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textBody(input: JoinApplicationEmail): string {
  return [
    "PostMineClanへ新しい参加申請が届きました。",
    "",
    `表示名: ${input.displayName}`,
    `メールアドレス: ${input.email}`,
    `Minecraftゲーマータグ: ${input.minecraftGamertag}`,
    `Discordユーザー名: ${input.discordUsername}`,
    "",
    "参加したい理由・やってみたいこと:",
    input.motivation,
    "",
    "確認事項: 年齢要件・Minecraft接続環境・利用規約・プライバシーポリシーに同意済み",
  ].join("\n");
}

function htmlBody(input: JoinApplicationEmail): string {
  const rows = [
    ["表示名", input.displayName],
    ["メールアドレス", input.email],
    ["Minecraftゲーマータグ", input.minecraftGamertag],
    ["Discordユーザー名", input.discordUsername],
  ].map(([label, value]) => `<tr><th style="padding:8px;text-align:left;vertical-align:top">${label}</th><td style="padding:8px">${htmlEscape(value)}</td></tr>`).join("");
  return `<h1>新しい参加申請</h1><table>${rows}</table><h2>参加したい理由・やってみたいこと</h2><p style="white-space:pre-wrap">${htmlEscape(input.motivation)}</p><p>年齢要件・Minecraft接続環境・利用規約・プライバシーポリシーに同意済みです。</p>`;
}

export async function sendJoinApplicationEmail(input: JoinApplicationEmail, submissionId: string): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new ApiRouteError("現在、参加申請を送信できません。時間をおいてもう一度お試しください。", 503, "EMAIL_UNAVAILABLE");
  }

  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `join-application/${submissionId}`,
      },
      body: JSON.stringify({
        from,
        to: [JOIN_APPLICATION_RECIPIENT],
        reply_to: input.email,
        subject: `参加申請: ${input.displayName.replace(/[\r\n]+/g, " ")}`,
        text: textBody(input),
        html: htmlBody(input),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiRouteError("参加申請を送信できませんでした。時間をおいてもう一度お試しください。", 502, "EMAIL_SEND_FAILED");
  }

  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!response.ok || typeof result?.id !== "string") {
    throw new ApiRouteError("参加申請を送信できませんでした。時間をおいてもう一度お試しください。", 502, "EMAIL_SEND_FAILED");
  }
  return result.id;
}

export async function sendJoinDecisionEmail(
  input: Pick<JoinApplicationEmail, "displayName" | "email">,
  status: "accepted" | "rejected",
  message: string,
  submissionId: string,
): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new ApiRouteError("判定結果のメールを送信できません。", 503, "EMAIL_UNAVAILABLE");
  }
  const accepted = status === "accepted";
  const resultLabel = accepted ? "承認" : "見送り";
  const safeName = input.displayName.replace(/[\r\n]+/g, " ");
  const detail = message.trim() || (accepted
    ? "参加に向けた次の手順は、運営からあらためてご案内します。"
    : "今回は参加を見送らせていただきます。ご了承ください。");
  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `join-decision/${submissionId}/${status}`,
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        reply_to: JOIN_APPLICATION_RECIPIENT,
        subject: `PostMineClan参加申請の結果（${resultLabel}）`,
        text: `${safeName} 様\n\nPostMineClanへの参加申請について、${resultLabel}となりました。\n\n${detail}\n\nPostMineClan運営`,
        html: `<p>${htmlEscape(safeName)} 様</p><p>PostMineClanへの参加申請について、<strong>${resultLabel}</strong>となりました。</p><p style="white-space:pre-wrap">${htmlEscape(detail)}</p><p>PostMineClan運営</p>`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiRouteError("判定結果のメールを送信できませんでした。", 502, "EMAIL_SEND_FAILED");
  }
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!response.ok || typeof result?.id !== "string") {
    throw new ApiRouteError("判定結果のメールを送信できませんでした。", 502, "EMAIL_SEND_FAILED");
  }
  return result.id;
}
