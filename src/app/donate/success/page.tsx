import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "寄付を受け付けました" };

export default function DonationSuccessPage() {
  return (
    <main id="main-content" className="page-shell page-shell--narrow donation-result">
      <span className="donation-result__icon" aria-hidden="true">✓</span>
      <p className="eyebrow">Thank you</p>
      <h1>ご支援ありがとうございます</h1>
      <p>
        決済結果を確認しています。Stripeからの通知を受信すると寄付記録が確定します。
      </p>
      <Link className="button button--primary" href="/">トップページへ戻る</Link>
    </main>
  );
}
