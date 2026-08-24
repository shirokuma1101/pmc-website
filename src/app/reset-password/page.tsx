import Link from "next/link";
import { PasswordResetForm } from "@/components/auth";
import { Alert } from "@/components/ui/Alert";

export const metadata = { title: "新しいパスワード", referrer: "no-referrer" as const };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const value = (await searchParams).token;
  const token = Array.isArray(value) ? value[0] : value;
  return (
    <main id="main-content" className="auth-page">
      <div className="auth-page__backdrop" aria-hidden="true" />
      {token ? <PasswordResetForm token={token} /> : (
        <section className="auth-card" aria-labelledby="invalid-reset-title">
          <div className="auth-card__heading">
            <p className="eyebrow">PASSWORD RESET</p>
            <h1 id="invalid-reset-title">リンクを確認してください</h1>
          </div>
          <Alert tone="error">再設定用トークンがありません。新しいリンクを発行してください。</Alert>
          <div className="auth-card__footer"><Link href="/forgot-password">再設定メールを送信</Link></div>
        </section>
      )}
    </main>
  );
}
