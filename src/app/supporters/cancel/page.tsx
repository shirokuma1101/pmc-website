import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "お申し込みをキャンセルしました" };
export default function SupportCancelPage() { return <main id="main-content" className="page-shell page-shell--narrow donation-result"><span className="donation-result__icon donation-result__icon--muted" aria-hidden="true">←</span><p className="eyebrow">Canceled</p><h1>決済は行われていません</h1><p>お申し込みはキャンセルされました。いつでも再度お手続きいただけます。</p><div className="donation-result__actions"><Link className="button button--primary" href="/supporters">サポーター画面へ戻る</Link><Link className="button button--ghost" href="/">トップページへ戻る</Link></div></main>; }
