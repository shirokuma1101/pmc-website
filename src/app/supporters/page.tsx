import type { Metadata } from "next";
import { SupportForm } from "@/components/support";
import { getSession } from "@/lib/auth/session";
import { stripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "サポーターになる", description: "PostMineClanの活動を支えるサポーター制度のご案内です。" };

export default async function SupportPage() {
  const session = await getSession();
  return (
    <main id="main-content" className="page-shell page-shell--narrow donation-page">
      <header className="page-heading donation-heading"><p className="eyebrow">Support PostMineClan</p><h1>好きを創る活動を、支える。</h1><p>サポーターからいただく支援金は、PostMineClanのWebサイト運営や制作活動を続けるために活用します。</p></header>
      <section className="donation-card" aria-labelledby="support-form-title"><div className="donation-card__intro"><span className="donation-card__icon" aria-hidden="true">♡</span><div><p className="eyebrow">Choose your support</p><h2 id="support-form-title">支援方法を選ぶ</h2></div></div><SupportForm checkoutEnabled={stripeEnabled()} loggedIn={Boolean(session)} />{session && stripeEnabled() ? <form action="/api/supporters/portal" method="post"><button className="button button--ghost button--full" type="submit">支払い方法・月額プランを管理</button></form> : null}</section>
      <section className="donation-usage" aria-labelledby="support-usage-title"><div className="donation-section-heading"><p className="eyebrow">How we use it</p><h2 id="support-usage-title">支援金の主な用途</h2></div><div className="donation-usage__grid"><article><span aria-hidden="true">01</span><h3>Minecraftサーバーの運営維持</h3><p>メンバーが安心して遊び、活動できるMinecraftサーバーの維持費に使用します。</p></article><article><span aria-hidden="true">02</span><h3>Webサイトの運営</h3><p>活動記録を公開するWebサイトのサーバー、ドメイン、ストレージなどの維持費に使用します。</p></article><article><span aria-hidden="true">03</span><h3>コミュニティの継続</h3><p>メンバーが安心して創作と発信を続けられる場所づくりに役立てます。</p></article></div></section>
      <aside className="donation-policy" aria-label="支援に関する注意事項"><h2>お申し込み前にご確認ください</h2><ul><li>1回支援では、購入個数と同じ月数だけStandard Supporter特典を提供します。期間中の追加購入分は現在の有効期限から延長されます。</li><li>月額サポーターは解約するまで自動更新され、プランの金額が毎月決済されます。</li><li>決済完了後の返金は、重複決済など個別に確認できる場合を除き原則として受け付けません。</li><li>本制度の支援金について、税制上の控除に必要な領収書は発行できません。</li></ul></aside>
    </main>
  );
}
