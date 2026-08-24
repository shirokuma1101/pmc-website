"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { safeInternalPath } from "@/lib/navigation";

import { getApiErrorMessage } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export interface LoginFormProps {
  endpoint?: string;
  redirectTo?: string;
  title?: string;
  description?: string;
  notice?: string;
  footer?: ReactNode;
}

async function getErrorMessage(response: Response, fallback: string) {
  if (response.status === 429) return "試行回数が多すぎます。少し時間をおいてからお試しください。";
  return getApiErrorMessage(response, fallback);
}

export function LoginForm({
  endpoint = "/api/auth/login",
  redirectTo = "/timeline",
  title = "おかえりなさい",
  description = "活動を記録するには、アカウントへログインしてください。",
  notice,
  footer,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    if (requiresOtp && !/^\d{6}$/.test(otp)) {
      setError("認証アプリに表示された6桁のコードを入力してください。");
      return;
    }
    if (!requiresOtp && otp && !/^\d{6}$/.test(otp)) {
      setError("2段階認証コードは6桁で入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(otp ? { otp } : {}),
        }),
      });
      if (response.status === 202) {
        setRequiresOtp(true);
        setOtp("");
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(
          response,
          requiresOtp
            ? "認証コードを確認して、もう一度お試しください。"
            : "メールアドレスまたはパスワードを確認してください。",
        ));
      }

      router.push(safeInternalPath(redirectTo));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ログインできませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  function returnToCredentials() {
    setRequiresOtp(false);
    setPassword("");
    setOtp("");
    setError(null);
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-card__mark" aria-hidden="true">記</div>
      <div className="auth-card__heading">
        <p className="eyebrow">SIGN IN</p>
        <h1 id="login-title">{title}</h1>
        <p>{description}</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        {requiresOtp ? (
          <>
            <Alert tone="info" title="2段階認証">
              認証アプリに表示された6桁のコードを入力してください。
            </Alert>
            <p className="auth-form__identity">
              ログイン先: <strong>{email.trim()}</strong>
            </p>
            <Input
              label="認証コード"
              hint="コードは一定時間で切り替わります。現在表示されているコードを入力してください。"
              id="login-otp"
              name="otp"
              type="text"
              value={otp}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              disabled={submitting}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </>
        ) : (
          <>
            <Input
              label="メールアドレス"
              id="login-email"
              name="email"
              type="email"
              value={email}
              autoComplete="email"
              inputMode="email"
              required
              disabled={submitting}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              label="パスワード"
              id="login-password"
              name="password"
              type="password"
              value={password}
              autoComplete="current-password"
              required
              disabled={submitting}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Input
              label="2段階認証コード（設定している場合）"
              hint="2段階認証を有効にしている方は、認証アプリの6桁コードも入力してください。"
              id="login-otp-optional"
              name="otp"
              type="text"
              value={otp}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              disabled={submitting}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </>
        )}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" fullWidth size="lg" loading={submitting}>
          {requiresOtp ? "認証してログイン" : "ログイン"}
        </Button>
        {requiresOtp ? (
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={submitting}
            onClick={returnToCredentials}
          >
            メールアドレスとパスワードを入力し直す
          </Button>
        ) : null}
      </form>

      <div className="auth-card__footer">
        {footer ?? <Link href="/">公開ページへ戻る</Link>}
      </div>
    </section>
  );
}
