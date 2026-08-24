import Link from "next/link";
import { Alert } from "@/components/ui";

export const metadata = { title: "承認待ち" };

export default function RegistrationPendingPage() {
  return <main id="main-content" className="auth-page"><div className="auth-page__backdrop" aria-hidden="true" /><section className="auth-card" aria-labelledby="pending-title">
    <div className="auth-card__mark" aria-hidden="true">待</div>
    <div className="auth-card__heading"><p className="eyebrow">PENDING APPROVAL</p><h1 id="pending-title">申請を受け付けました</h1><p>管理者が承認すると、登録したメールアドレスとパスワードでログインできるようになります。</p></div>
    <Alert tone="info">承認が完了するまではログインできません。しばらくお待ちください。</Alert>
    <div className="auth-card__footer"><Link href="/">公開ページへ戻る</Link></div>
  </section></main>;
}
