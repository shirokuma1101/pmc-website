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
import { SsoButton } from "./SsoButton";
import { TurnstileWidget } from "./TurnstileWidget";

export interface LoginFormProps {
  endpoint?: string;
  redirectTo?: string;
  title?: string;
  description?: string;
  notice?: string;
  footer?: ReactNode;
  ssoProviders?: Array<"google" | "x">;
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
  ssoProviders = [],
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

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
    if (!turnstileToken) {
      setError("セキュリティ確認を完了してください。");
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
          turnstileToken,
        }),
      });
      if (response.status === 202) {
        setRequiresOtp(true);
        setOtp("");
        setTurnstileResetKey((value) => value + 1);
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
      setTurnstileResetKey((value) => value + 1);
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
      <div className="auth-card__mark" aria-hidden="true">{requiresOtp ? "鍵" : "記"}</div>
      <div className="auth-card__heading">
        <p className="eyebrow">{requiresOtp ? "TWO-FACTOR AUTHENTICATION" : "SIGN IN"}</p>
        <h1 id="login-title">{requiresOtp ? "認証コードを入力" : title}</h1>
        <p>{requiresOtp ? "認証アプリに表示されている6桁のコードを入力してください。" : description}</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {notice && !requiresOtp ? <Alert tone="success">{notice}</Alert> : null}
        {requiresOtp ? (
          <>
            <p className="auth-form__identity">
              ログイン先: <strong>{email.trim()}</strong>
            </p>
            <label className="auth-otp" htmlFor="login-otp">
              <span className="field__label">認証コード<span className="field__required">必須</span></span>
              <span className="auth-otp__slots" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    key={index}
                    className={index === otp.length ? "is-active" : undefined}
                  >
                    {otp[index] ?? ""}
                  </span>
                ))}
              </span>
              <input
                className="auth-otp__input"
                aria-label="認証コード"
                aria-describedby="login-otp-hint"
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
              <span className="field__hint" id="login-otp-hint">コードは一定時間で切り替わります。現在表示されているコードを入力してください。</span>
            </label>
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
          </>
        )}
        <TurnstileWidget action="login" onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!turnstileToken}>
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

      {ssoProviders.length ? (
        <div className="auth-sso" aria-label="外部サービスでログイン">
          <p className="auth-sso__separator"><span>または</span></p>
          {ssoProviders.includes("google") ? <SsoButton provider="google" label="Google" /> : null}
          {ssoProviders.includes("x") ? <SsoButton provider="x" label="X" /> : null}
        </div>
      ) : null}

      <div className="auth-card__footer">
        {footer ?? <Link href="/">公開ページへ戻る</Link>}
      </div>
    </section>
  );
}
