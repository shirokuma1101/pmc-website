"use client";

import { useState } from "react";
import { getApiErrorMessage } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TurnstileWidget } from "./TurnstileWidget";

export function SsoButton({ provider, label }: { provider: "google" | "x"; label: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function startSso() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/sso/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ turnstileToken: token }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "認証を開始できませんでした。"));
      const payload = await response.json() as { data?: { authorizationUrl?: string } };
      if (!payload.data?.authorizationUrl) throw new Error("認証を開始できませんでした。");
      window.location.assign(payload.data.authorizationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "認証を開始できませんでした。");
      setResetKey((value) => value + 1);
      setSubmitting(false);
    }
  }

  return (
    <div className="sso-option">
      <TurnstileWidget action={provider === "google" ? "google-sso" : "x-sso"} onTokenChange={setToken} resetKey={resetKey} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button type="button" variant="secondary" fullWidth loading={submitting} disabled={!token} onClick={startSso}>
        {label}でログイン
      </Button>
    </div>
  );
}
