"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { getApiErrorMessage } from "../apiResponse";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function RegistrationForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!displayName.trim() || !email.trim() || !password) {
      setError("すべての項目を入力してください。");
      return;
    }
    if (password.length < 12) {
      setError("パスワードは12文字以上で入力してください。");
      return;
    }
    if (password !== confirmation) {
      setError("確認用パスワードが一致しません。");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ displayName: displayName.trim(), email: email.trim(), password }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "アカウントを作成できませんでした。"));
      router.push("/register/pending");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "アカウントを作成できませんでした。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card" aria-labelledby="registration-title">
      <div className="auth-card__mark" aria-hidden="true">新</div>
      <div className="auth-card__heading">
        <p className="eyebrow">CREATE ACCOUNT</p>
        <h1 id="registration-title">アカウントを作成</h1>
        <p>活動の投稿や記事へのいいねができるMemberアカウントを作成します。</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <Input label="表示名" name="displayName" value={displayName} maxLength={80} autoComplete="nickname" required disabled={submitting} onChange={(event) => setDisplayName(event.target.value)} />
        <Input label="メールアドレス" name="email" type="email" value={email} maxLength={254} autoComplete="email" inputMode="email" required disabled={submitting} onChange={(event) => setEmail(event.target.value)} />
        <Input label="パスワード" hint="12文字以上で設定してください。" name="password" type="password" value={password} minLength={12} maxLength={128} autoComplete="new-password" required disabled={submitting} onChange={(event) => setPassword(event.target.value)} />
        <Input label="パスワード（確認）" name="passwordConfirmation" type="password" value={confirmation} minLength={12} maxLength={128} autoComplete="new-password" required disabled={submitting} onChange={(event) => setConfirmation(event.target.value)} />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" fullWidth size="lg" loading={submitting}>アカウントを作成</Button>
      </form>
      <div className="auth-card__footer"><Link href="/login">すでにアカウントをお持ちの方</Link></div>
    </section>
  );
}
