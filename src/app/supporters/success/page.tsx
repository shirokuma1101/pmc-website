import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "お申し込みを受け付けました" };
export default function SupportSuccessPage() { return <main id="main-content" className="page-shell page-shell--narrow donation-result"><span className="donation-result__icon" aria-hidden="true">✓</span><p className="eyebrow">Thank you</p><h1>ご支援ありがとうございます</h1><p>Stripeからの通知を受信後、支援記録とサポーター情報が確定します。</p><Link className="button button--primary" href="/">トップページへ戻る</Link></main>; }
