"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { getApiErrorMessage } from "@/components/apiResponse";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Alert, Button, Input, Textarea } from "@/components/ui";

interface JoinApplication {
  displayName: string;
  email: string;
  minecraftGamertag: string;
  discordUsername: string;
  motivation: string;
}

const EMPTY_APPLICATION: JoinApplication = {
  displayName: "",
  email: "",
  minecraftGamertag: "",
  discordUsername: "",
  motivation: "",
};

export function JoinApplicationForm() {
  const [application, setApplication] = useState(EMPTY_APPLICATION);
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const submissionId = useRef(crypto.randomUUID());

  function update<K extends keyof JoinApplication>(key: K, value: JoinApplication[K]) {
    setApplication((current) => ({ ...current, [key]: value }));
  }

  function showConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirming(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitApplication() {
    if (!turnstileToken) {
      setError("セキュリティ確認を完了してください。");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...application,
          submissionId: submissionId.current,
          ageRequirement: true,
          minecraftRequirement: true,
          policyConsent: true,
          turnstileToken,
        }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "参加申請を送信できませんでした。"));
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "参加申請を送信できませんでした。");
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="join-form-card" aria-labelledby="join-complete-title">
        <div className="join-form-card__heading">
          <p className="eyebrow">Submitted</p>
          <h2 id="join-complete-title">参加申請を受け付けました</h2>
          <p>内容を確認後、入力したメールアドレスへ参加可否をご連絡します。</p>
        </div>
        <Alert tone="success">申請が送信されました。ご連絡までしばらくお待ちください。</Alert>
      </section>
    );
  }

  if (confirming) {
    return (
      <section className="join-form-card" aria-labelledby="join-confirmation-title">
        <div className="join-form-card__heading">
          <p className="eyebrow">Confirm</p>
          <h2 id="join-confirmation-title">申請内容の確認</h2>
          <p>以下の内容で間違いがないか確認してください。</p>
        </div>
        <dl className="join-confirmation">
          <div><dt>表示名</dt><dd>{application.displayName}</dd></div>
          <div><dt>メールアドレス</dt><dd>{application.email}</dd></div>
          <div><dt>Minecraftゲーマータグ</dt><dd>{application.minecraftGamertag}</dd></div>
          <div><dt>Discordユーザー名</dt><dd>{application.discordUsername}</dd></div>
          <div className="join-confirmation__wide"><dt>参加したい理由・やってみたいこと</dt><dd>{application.motivation}</dd></div>
        </dl>
        <TurnstileWidget action="join-application" onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="join-form-actions">
          <Button variant="secondary" disabled={submitting} onClick={() => {
            setError(null);
            setConfirming(false);
          }}>入力内容を修正</Button>
          <Button loading={submitting} disabled={!turnstileToken} onClick={submitApplication}>申請を送信</Button>
        </div>
      </section>
    );
  }

  return (
    <form className="join-form-card" onSubmit={showConfirmation}>
      <div className="join-form-card__heading">
        <p className="eyebrow">Application</p>
        <h2>参加申請フォーム</h2>
        <p><span aria-hidden="true">*</span> 必須項目を入力し、確認画面へ進んでください。</p>
      </div>

      <fieldset className="join-form-section">
        <legend>あなたについて</legend>
        <div className="join-form-grid">
          <Input
            label="表示名"
            name="displayName"
            value={application.displayName}
            maxLength={50}
            autoComplete="name"
            hint="サイトやDiscordで呼ばれたい名前"
            required
            onChange={(event) => update("displayName", event.target.value)}
          />
          <Input
            label="メールアドレス"
            name="email"
            type="email"
            value={application.email}
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            hint="受付完了と参加可否の連絡に使用します"
            required
            onChange={(event) => update("email", event.target.value)}
          />
          <Input
            label="Minecraftゲーマータグ"
            name="minecraftGamertag"
            value={application.minecraftGamertag}
            maxLength={32}
            autoComplete="off"
            required
            onChange={(event) => update("minecraftGamertag", event.target.value)}
          />
          <Input
            label="Discordユーザー名"
            name="discordUsername"
            value={application.discordUsername}
            maxLength={64}
            autoComplete="off"
            hint="例: postmine_user"
            required
            onChange={(event) => update("discordUsername", event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="join-form-section">
        <legend>参加について</legend>
        <Textarea
          label="参加したい理由・やってみたいこと"
          name="motivation"
          value={application.motivation}
          maxLength={1000}
          rows={7}
          hint={`${application.motivation.length}/1000文字`}
          required
          onChange={(event) => update("motivation", event.target.value)}
        />
      </fieldset>

      <fieldset className="join-form-section join-form-consents">
        <legend>確認事項</legend>
        <label className="join-checkbox">
          <input type="checkbox" name="ageRequirement" required />
          <span>15歳以上で、義務教育を修了しています。</span>
        </label>
        <label className="join-checkbox">
          <input type="checkbox" name="minecraftRequirement" required />
          <span>Minecraft統合版で外部サーバーへ接続できる環境があります。</span>
        </label>
        <label className="join-checkbox">
          <input type="checkbox" name="policyConsent" required />
          <span>
            <Link href="/terms" target="_blank">利用規約</Link>と
            <Link href="/privacy" target="_blank">プライバシーポリシー</Link>を確認し、同意します。
          </span>
        </label>
      </fieldset>

      <div className="join-form-actions">
        <Button type="submit" size="lg">入力内容を確認</Button>
      </div>
    </form>
  );
}
