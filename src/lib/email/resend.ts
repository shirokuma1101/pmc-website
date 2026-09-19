import "server-only";

import { ApiRouteError } from "@/lib/api/route";
import { getPublicAppUrl } from "@/lib/config";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const JOIN_APPLICATION_RECIPIENT = "support@postmineclan.com";

type SupporterEventType =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed"
  | "invoice.paid"
  | "invoice.payment_failed"
  | "customer.subscription.updated"
  | "customer.subscription.deleted";

interface StripeSupportObject {
  id?: unknown;
  customer?: unknown;
  customer_email?: unknown;
  customer_details?: { email?: unknown; name?: unknown } | null;
  metadata?: Record<string, unknown> | null;
  parent?: { subscription_details?: { metadata?: Record<string, unknown> | null } | null } | null;
  subscription_details?: { metadata?: Record<string, unknown> | null } | null;
  amount_total?: unknown;
  amount_paid?: unknown;
  amount_due?: unknown;
  currency?: unknown;
  payment_status?: unknown;
  status?: unknown;
  billing_reason?: unknown;
  hosted_invoice_url?: unknown;
}

export interface StripeSupportEmailEvent {
  id: string;
  type: SupporterEventType;
  object: StripeSupportObject;
}

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

async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  replyTo?: string;
  unavailableMessage: string;
  failureMessage: string;
}): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new ApiRouteError(input.unavailableMessage, 503, "EMAIL_UNAVAILABLE");

  let response: Response;
  try {
    response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiRouteError(input.failureMessage, 502, "EMAIL_SEND_FAILED");
  }
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!response.ok || typeof result?.id !== "string") throw new ApiRouteError(input.failureMessage, 502, "EMAIL_SEND_FAILED");
  return result.id;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function supporterMetadata(object: StripeSupportObject): Record<string, unknown> {
  return object.metadata
    ?? object.parent?.subscription_details?.metadata
    ?? object.subscription_details?.metadata
    ?? {};
}

function supporterPlanLabel(object: StripeSupportObject): string {
  const tier = stringValue(supporterMetadata(object).tier);
  if (tier === "basic") return "Basic Supporter";
  if (tier === "standard") return "Standard Supporter";
  if (tier === "premium") return "Premium Supporter";
  return "Supporter（1回支援）";
}

function yenAmount(object: StripeSupportObject, kind: "paid" | "due" = "paid"): number | undefined {
  const candidate = kind === "paid"
    ? object.amount_paid ?? object.amount_total
    : object.amount_due ?? object.amount_total;
  return typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : undefined;
}

function amountLine(amount: number | undefined, currency: unknown): string | undefined {
  if (amount === undefined) return undefined;
  return stringValue(currency)?.toLowerCase() === "jpy"
    ? `¥${amount.toLocaleString("ja-JP")}`
    : `${amount} ${stringValue(currency)?.toUpperCase() ?? ""}`.trim();
}

async function stripeCustomerEmail(customer: unknown): Promise<string | undefined> {
  if (typeof customer === "object" && customer) return stringValue((customer as { email?: unknown }).email);
  const customerId = stringValue(customer);
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!customerId?.startsWith("cus_") || !apiKey) return undefined;
  const response = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return undefined;
  const result = await response.json().catch(() => null) as { email?: unknown } | null;
  return stringValue(result?.email);
}

export async function sendSupporterPaymentEmail(event: StripeSupportEmailEvent): Promise<string | null> {
  const object = event.object;
  if (event.type === "customer.subscription.updated") return null;
  if (event.type === "invoice.paid" && object.billing_reason === "subscription_create") return null;
  if ((event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded")
    && object.payment_status !== "paid" && object.payment_status !== "no_payment_required") return null;
  const email = stringValue(object.customer_details?.email)
    ?? stringValue(object.customer_email)
    ?? await stripeCustomerEmail(object.customer);
  if (!email) return null;

  const displayName = stringValue(object.customer_details?.name);
  const greeting = displayName ? `${displayName} 様` : "サポーター様";
  const plan = supporterPlanLabel(object);
  const supportersUrl = `${getPublicAppUrl()}/supporters`;
  let subject: string;
  let heading: string;
  let message: string;
  let amount: string | undefined;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    subject = "PostMineClanへのご支援ありがとうございます";
    heading = "ご支援を受け付けました";
    message = `${plan}のお申し込みが完了しました。サポーター特典はサイトへ順次反映されます。`;
    amount = amountLine(yenAmount(object), object.currency);
  } else if (event.type === "checkout.session.async_payment_failed") {
    subject = "PostMineClanへのお支払いを完了できませんでした";
    heading = "お支払いが完了していません";
    message = `${plan}のお支払いを確認できませんでした。支払い方法をご確認のうえ、必要に応じてもう一度お手続きください。`;
    amount = amountLine(yenAmount(object, "due"), object.currency);
  } else if (event.type === "invoice.paid") {
    subject = "PostMineClanサポーターの月額更新が完了しました";
    heading = "月額サポーターを更新しました";
    message = `${plan}の今月分のお支払いを確認しました。引き続きご支援いただきありがとうございます。`;
    amount = amountLine(yenAmount(object), object.currency);
  } else if (event.type === "invoice.payment_failed") {
    subject = "PostMineClanサポーターのお支払いを確認できませんでした";
    heading = "月額料金のお支払いに失敗しました";
    message = `${plan}の月額料金をお支払いいただけませんでした。Stripeの支払い方法をご確認ください。`;
    amount = amountLine(yenAmount(object, "due"), object.currency);
  } else if (event.type === "customer.subscription.deleted") {
    subject = "PostMineClanサポーターの解約を受け付けました";
    heading = "月額サポーターを終了しました";
    message = `${plan}の解約処理が完了しました。これまでご支援いただき、ありがとうございました。`;
  } else {
    return null;
  }

  const lines = [greeting, "", message, ...(amount ? ["", `金額: ${amount}`] : []), "", `サポーター画面: ${supportersUrl}`, "", "PostMineClan運営"];
  const invoiceUrl = stringValue(object.hosted_invoice_url);
  if (invoiceUrl?.startsWith("https://")) lines.splice(lines.length - 3, 0, `請求内容: ${invoiceUrl}`, "");
  const detailRows = [
    `<tr><th style="padding:8px;text-align:left">プラン</th><td style="padding:8px">${htmlEscape(plan)}</td></tr>`,
    ...(amount ? [`<tr><th style="padding:8px;text-align:left">金額</th><td style="padding:8px">${htmlEscape(amount)}</td></tr>`] : []),
  ].join("");
  return sendResendEmail({
    to: email,
    replyTo: JOIN_APPLICATION_RECIPIENT,
    subject,
    text: lines.join("\n"),
    html: `<p>${htmlEscape(greeting)}</p><h1>${htmlEscape(heading)}</h1><p>${htmlEscape(message)}</p><table>${detailRows}</table>${invoiceUrl?.startsWith("https://") ? `<p><a href="${htmlEscape(invoiceUrl)}">請求内容を確認する</a></p>` : ""}<p><a href="${htmlEscape(supportersUrl)}">サポーター画面を開く</a></p><p>PostMineClan運営</p>`,
    idempotencyKey: `stripe-support/${event.id}/${event.type}`,
    unavailableMessage: "支払い通知メールを送信できません。",
    failureMessage: "支払い通知メールを送信できませんでした。",
  });
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
