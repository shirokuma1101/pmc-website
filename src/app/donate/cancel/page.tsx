import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "寄付をキャンセルしました" };

export default function DonationCancelPage() {
  return (
    <main id="main-content" className="page-shell page-shell--narrow donation-result">
      <span className="donation-result__icon donation-result__icon--muted" aria-hidden="true">←</span>
      <p className="eyebrow">Canceled</p>
      <h1>決済は行われていません</h1>
      <p>寄付の手続きはキャンセルされました。いつでも再度お手続きいただけます。</p>
      <div className="donation-result__actions">
        <Link className="button button--primary" href="/donate">寄付画面へ戻る</Link>
        <Link className="button button--ghost" href="/">トップページへ戻る</Link>
      </div>
    </main>
  );
}
