"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { getApiErrorMessage } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { TurnstileWidget } from "./TurnstileWidget";

async function responseError(response: Response, fallback: string): Promise<string> {
  if (response.status === 429) return "試行回数が多すぎます。時間をおいてからお試しください。";
  return getApiErrorMessage(response, fallback);
}

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!turnstileToken) {
      setError("セキュリティ確認を完了してください。");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), turnstileToken }),
      });
      if (!response.ok) throw new Error(await responseError(response, "再設定メールを送信できませんでした。"));
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "再設定メールを送信できませんでした。");
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="password-request-title">
      <div className="auth-card__mark" aria-hidden="true">鍵</div>
      <div className="auth-card__heading">
        <p className="eyebrow">PASSWORD RESET</p>
        <h1 id="password-request-title">パスワードを再設定</h1>
        <p>登録したメールアドレスへ再設定リンクを送信します。</p>
      </div>
      {sent ? (
        <Alert tone="success" title="メールをご確認ください">
          アカウントが存在する場合、再設定リンクを送信しました。リンクの有効期限内に手続きを完了してください。
        </Alert>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <Input
            label="メールアドレス"
            id="password-reset-email"
            name="email"
            type="email"
            value={email}
            autoComplete="email"
            inputMode="email"
            required
            disabled={submitting}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TurnstileWidget action="password-reset-request" onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!turnstileToken}>再設定メールを送信</Button>
        </form>
      )}
      <div className="auth-card__footer"><Link href="/login">ログインへ戻る</Link></div>
    </section>
  );
}

export function PasswordResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 12 || password.length > 128) {
      setError("パスワードは12～128文字で入力してください。");
      return;
    }
    if (password !== confirmation) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) throw new Error(await responseError(response, "パスワードを変更できませんでした。"));
      router.replace("/login?notice=password-reset");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "パスワードを変更できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="password-reset-title">
      <div className="auth-card__mark" aria-hidden="true">鍵</div>
      <div className="auth-card__heading">
        <p className="eyebrow">NEW PASSWORD</p>
        <h1 id="password-reset-title">新しいパスワード</h1>
        <p>12文字以上の新しいパスワードを設定してください。</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input label="新しいパスワード" id="new-password" type="password" value={password}
          autoComplete="new-password" minLength={12} maxLength={128} required disabled={submitting}
          onChange={(event) => setPassword(event.target.value)} />
        <Input label="新しいパスワード（確認）" id="new-password-confirmation" type="password"
          value={confirmation} autoComplete="new-password" minLength={12} maxLength={128} required
          disabled={submitting} onChange={(event) => setConfirmation(event.target.value)} />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" fullWidth size="lg" loading={submitting}>パスワードを変更</Button>
      </form>
      <div className="auth-card__footer"><Link href="/forgot-password">新しいリンクを発行する</Link></div>
    </section>
  );
}
