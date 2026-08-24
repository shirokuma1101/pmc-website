"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { getApiErrorMessage, unwrapApiData } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

interface TwoFactorSetupData {
  secret: string;
  qrDataUrl: string;
}

type SettingsStep = "idle" | "password" | "setup" | "disable";

export interface TwoFactorSettingsProps {
  enabled: boolean;
}

function normalizedOtp(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function isSetupData(value: TwoFactorSetupData | null): value is TwoFactorSetupData {
  return Boolean(value?.secret && value.qrDataUrl);
}

export function TwoFactorSettings({ enabled }: TwoFactorSettingsProps) {
  const router = useRouter();
  const isEnabled = enabled;
  const [step, setStep] = useState<SettingsStep>("idle");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [setup, setSetup] = useState<TwoFactorSetupData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  function clearSensitiveState() {
    setPassword("");
    setOtp("");
    setSetup(null);
    setCopyNotice(null);
  }

  function cancel() {
    const invalidateSetup = step === "setup";
    clearSensitiveState();
    setError(null);
    setStep("idle");
    if (invalidateSetup) {
      void fetch("/api/auth/tfa/cancel", {
        method: "POST",
        credentials: "include",
      }).catch(() => undefined);
    }
  }

  function start(nextStep: "password" | "disable") {
    clearSensitiveState();
    setError(null);
    setStep(nextStep);
  }

  async function generateSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!password) {
      setError("現在のパスワードを入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/tfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "2段階認証の設定を開始できませんでした。"));
      }

      const payload: unknown = await response.json().catch(() => null);
      const data = unwrapApiData<TwoFactorSetupData>(payload);
      if (!isSetupData(data)) throw new Error("設定情報を取得できませんでした。もう一度お試しください。");

      setPassword("");
      setOtp("");
      setSetup(data);
      setStep("setup");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "2段階認証の設定を開始できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  async function enableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!setup || !/^\d{6}$/.test(otp)) {
      setError("認証アプリに表示された6桁のコードを入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/tfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otp }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "2段階認証を有効にできませんでした。"));
      }

      clearSensitiveState();
      router.replace("/login?next=/settings/security&notice=tfa-enabled");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "2段階認証を有効にできませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!password || !/^\d{6}$/.test(otp)) {
      setError("現在のパスワードと、認証アプリに表示された6桁のコードを入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/tfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, otp }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "2段階認証を無効にできませんでした。"));
      }

      clearSensitiveState();
      router.replace("/login?next=/settings/security&notice=tfa-disabled");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "2段階認証を無効にできませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  async function copySecret() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopyNotice("設定キーをコピーしました。");
    } catch {
      setCopyNotice("コピーできませんでした。設定キーを選択してコピーしてください。");
    }
  }

  return (
    <section className="surface-card security-card" aria-labelledby="two-factor-title">
      <div className="security-card__heading">
        <div>
          <p className="eyebrow">Two-factor authentication</p>
          <h2 id="two-factor-title">2段階認証</h2>
        </div>
        <span
          className={`security-status security-status--${isEnabled ? "enabled" : "disabled"}`}
        >
          {isEnabled ? "有効" : "未設定"}
        </span>
      </div>

      {step === "idle" ? (
        <div className="security-card__body">
          <p>
            {isEnabled
              ? "ログイン時に、パスワードに加えて認証アプリのコードを確認します。"
              : "認証アプリで生成されるコードを追加し、パスワードだけではログインできないようにします。"}
          </p>
          <Button
            variant={isEnabled ? "danger" : "primary"}
            onClick={() => start(isEnabled ? "disable" : "password")}
          >
            {isEnabled ? "2段階認証を無効にする" : "設定を開始"}
          </Button>
        </div>
      ) : null}

      {step === "password" ? (
        <form className="security-form" onSubmit={generateSetup} noValidate>
          <Alert tone="info">安全のため、現在のパスワードを確認します。</Alert>
          <Input
            label="現在のパスワード"
            id="tfa-current-password"
            name="password"
            type="password"
            value={password}
            autoComplete="current-password"
            required
            autoFocus
            disabled={submitting}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="security-form__actions">
            <Button type="submit" loading={submitting}>次へ</Button>
            <Button type="button" variant="ghost" disabled={submitting} onClick={cancel}>キャンセル</Button>
          </div>
        </form>
      ) : null}

      {step === "setup" && setup ? (
        <form className="security-form" onSubmit={enableTwoFactor} noValidate>
          <div className="tfa-setup">
            <div>
              <h3>1. 認証アプリに登録</h3>
              <p>認証アプリでQRコードを読み取ってください。</p>
            </div>
            <div className="tfa-setup__qr">
              <img
                src={setup.qrDataUrl}
                alt="認証アプリに2段階認証を登録するためのQRコード"
                width={240}
                height={240}
              />
            </div>
            <div className="tfa-setup__manual">
              <p>QRコードを読み取れない場合は、次の設定キーを手動で入力します。</p>
              <code>{setup.secret}</code>
              <Button type="button" variant="secondary" size="sm" onClick={copySecret}>
                設定キーをコピー
              </Button>
              <p className="field__hint" role="status" aria-live="polite">{copyNotice}</p>
            </div>
          </div>

          <div className="tfa-setup__verify">
            <h3>2. 認証コードで確認</h3>
            <Input
              label="6桁の認証コード"
              hint="登録した認証アプリに現在表示されているコードを入力してください。"
              id="tfa-enable-otp"
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
              onChange={(event) => setOtp(normalizedOtp(event.target.value))}
            />
          </div>
          <Alert tone="warning">QRコードと設定キーは共有しないでください。キャンセルすると、この設定は有効になりません。</Alert>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="security-form__actions">
            <Button type="submit" loading={submitting}>2段階認証を有効にする</Button>
            <Button type="button" variant="ghost" disabled={submitting} onClick={cancel}>キャンセル</Button>
          </div>
        </form>
      ) : null}

      {step === "disable" ? (
        <form className="security-form" onSubmit={disableTwoFactor} noValidate>
          <Alert tone="warning" title="2段階認証を無効にします">
            無効にすると、ログイン時に認証コードが確認されなくなります。
          </Alert>
          <Input
            label="現在のパスワード"
            hint="無効化の前に、パスワードと認証コードの両方を確認します。"
            id="tfa-disable-password"
            name="password"
            type="password"
            value={password}
            autoComplete="current-password"
            required
            autoFocus
            disabled={submitting}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Input
            label="6桁の認証コード"
            hint="本人確認のため、認証アプリに現在表示されているコードを入力してください。"
            id="tfa-disable-otp"
            name="otp"
            type="text"
            value={otp}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            disabled={submitting}
            onChange={(event) => setOtp(normalizedOtp(event.target.value))}
          />
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="security-form__actions">
            <Button type="submit" variant="danger" loading={submitting}>無効にする</Button>
            <Button type="button" variant="ghost" disabled={submitting} onClick={cancel}>キャンセル</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
