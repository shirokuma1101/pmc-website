"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { getApiErrorMessage } from "@/components/apiResponse";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Alert, Button, Input, Textarea } from "@/components/ui";
import type { ContactRecipientOption } from "@/lib/contact/recipients";

interface ContactDraft {
  recipientId: string;
  category: "supporter" | "account" | "community" | "other";
  displayName: string;
  email: string;
  subject: string;
  message: string;
}

export function ContactForm({ recipients }: { recipients: ContactRecipientOption[] }) {
  const [draft, setDraft] = useState<ContactDraft>({ recipientId: "support", category: "other", displayName: "", email: "", subject: "", message: "" });
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submissionId] = useState(() => crypto.randomUUID());
  const recipientLabel = recipients.find((recipient) => recipient.id === draft.recipientId)?.label ?? "共通窓口";

  function update<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function showConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirming(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitInquiry() {
    if (!turnstileToken) { setError("セキュリティ確認を完了してください。"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...draft, submissionId, policyConsent: true, turnstileToken }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "お問い合わせを送信できませんでした。"));
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "お問い合わせを送信できませんでした。");
      setTurnstileResetKey((value) => value + 1);
    } finally { setSubmitting(false); }
  }

  if (submitted) return <section className="join-form-card" aria-labelledby="contact-complete-title"><div className="join-form-card__heading"><p className="eyebrow">Submitted</p><h2 id="contact-complete-title">お問い合わせを受け付けました</h2><p>受付番号: {submissionId}</p></div><Alert tone="success">入力されたメールアドレスへ、担当者からご連絡します。</Alert></section>;

  if (confirming) return (
    <section className="join-form-card" aria-labelledby="contact-confirm-title">
      <div className="join-form-card__heading"><p className="eyebrow">Confirm</p><h2 id="contact-confirm-title">お問い合わせ内容の確認</h2></div>
      <dl className="join-confirmation">
        <div><dt>送信先</dt><dd>{recipientLabel}</dd></div>
        <div><dt>種別</dt><dd>{categoryLabels[draft.category]}</dd></div>
        <div><dt>お名前</dt><dd>{draft.displayName}</dd></div>
        <div><dt>返信先</dt><dd>{draft.email}</dd></div>
        <div><dt>件名</dt><dd>{draft.subject}</dd></div>
        <div className="join-confirmation__wide"><dt>内容</dt><dd style={{ whiteSpace: "pre-wrap" }}>{draft.message}</dd></div>
      </dl>
      <TurnstileWidget action="contact-inquiry" onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="join-form-actions"><Button variant="secondary" disabled={submitting} onClick={() => { setConfirming(false); setError(null); }}>入力内容を修正</Button><Button loading={submitting} disabled={!turnstileToken} onClick={submitInquiry}>お問い合わせを送信</Button></div>
    </section>
  );

  return (
    <form className="join-form-card" onSubmit={showConfirmation}>
      <div className="join-form-card__heading"><p className="eyebrow">Contact</p><h2>お問い合わせフォーム</h2><p>ご相談内容に応じて送信先を選び、確認画面へ進んでください。</p></div>
      <fieldset className="join-form-section"><legend>送信先と内容</legend><div className="join-form-grid">
        <label className="field"><span className="field__label">送信先</span><select className="input" value={draft.recipientId} onChange={(event) => update("recipientId", event.target.value)}>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.label}</option>)}</select></label>
        <label className="field"><span className="field__label">お問い合わせの種類</span><select className="input" value={draft.category} onChange={(event) => update("category", event.target.value as ContactDraft["category"])}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <Input label="お名前" name="displayName" value={draft.displayName} maxLength={80} autoComplete="name" required onChange={(event) => update("displayName", event.target.value)} />
        <Input label="返信先メールアドレス" name="email" type="email" value={draft.email} maxLength={254} autoComplete="email" required onChange={(event) => update("email", event.target.value)} />
      </div><Input label="件名" name="subject" value={draft.subject} maxLength={160} required onChange={(event) => update("subject", event.target.value)} /><Textarea label="お問い合わせ内容" name="message" value={draft.message} minLength={10} maxLength={5000} rows={8} required hint={`${draft.message.length}/5000文字`} onChange={(event) => update("message", event.target.value)} /></fieldset>
      <fieldset className="join-form-section join-form-consents"><legend>確認事項</legend><label className="join-checkbox"><input type="checkbox" required /><span><Link href="/privacy" target="_blank">プライバシーポリシー</Link>を確認し、問い合わせ内容と返信先の送信に同意します。</span></label></fieldset>
      <div className="join-form-actions"><Button type="submit" size="lg">入力内容を確認</Button></div>
    </form>
  );
}

const categoryLabels: Record<ContactDraft["category"], string> = { supporter: "サポーター・決済", account: "アカウント", community: "コミュニティ", other: "その他" };
