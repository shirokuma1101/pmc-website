import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/auth";
import { getSession } from "@/lib/auth/session";
import { safeInternalPath } from "@/lib/navigation";

export const metadata = { title: "ログイン" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; notice?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeInternalPath(params.next);
  const noticeValue = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notice = noticeValue === "tfa-enabled"
    ? "2段階認証を有効にしました。認証アプリのコードを使って、もう一度ログインしてください。"
    : noticeValue === "tfa-disabled"
      ? "2段階認証を無効にしました。安全のため、もう一度ログインしてください。"
      : noticeValue === "registered"
        ? "アカウントを作成しました。登録した情報でログインしてください。"
        : noticeValue === "password-reset"
          ? "パスワードを変更しました。新しいパスワードでログインしてください。"
        : undefined;
  if (await getSession()) redirect(next);

  return (
    <main id="main-content" className="auth-page">
      <div className="auth-page__backdrop" aria-hidden="true" />
      <LoginForm
        redirectTo={next}
        notice={notice}
        ssoProviders={[
          ...(process.env.GOOGLE_SSO_AUTH_URL ? ["google" as const] : []),
          ...(process.env.X_SSO_AUTH_URL ? ["x" as const] : []),
        ]}
        footer={process.env.REGISTRATION_ENABLED === "true"
          ? <><Link href="/forgot-password">パスワードを忘れた方</Link><span aria-hidden="true"> ・ </span><Link href="/register">新しいアカウントを作成</Link></>
          : <Link href="/forgot-password">パスワードを忘れた方</Link>}
      />
    </main>
  );
}
