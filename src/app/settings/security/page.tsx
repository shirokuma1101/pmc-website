import Link from "next/link";
import { redirect } from "next/navigation";
import { TwoFactorSettings } from "@/components/auth";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "セキュリティ設定" };

export default async function SecuritySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/settings/security");

  return (
    <main id="main-content" className="page-shell page-shell--narrow security-page">
      <header className="page-heading">
        <p className="eyebrow">Account security</p>
        <h1>セキュリティ設定</h1>
        <p>ログイン時の本人確認を追加して、PostMineClanアカウントを保護します。</p>
      </header>

      <TwoFactorSettings enabled={session.user.tfaEnabled} />

      <Link className="back-link security-page__back" href="/me">
        <span aria-hidden="true">←</span> マイプロフィールへ戻る
      </Link>
    </main>
  );
}
