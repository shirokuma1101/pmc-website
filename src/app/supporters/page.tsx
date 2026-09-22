import type { Metadata } from "next";
import { SupportForm } from "@/components/support";
import { getSession } from "@/lib/auth/session";
import { stripeEnabled } from "@/lib/stripe";
import { findSupporterSubscriptionCustomer } from "@/lib/supporter-subscriptions";
import { SUPPORTER_POLICY } from "@/lib/organization/supporter-policy";
import Link from "next/link";

export const metadata: Metadata = { title: "サポーターになる", description: "PostMineClanの活動を支えるサポーター制度のご案内です。" };

async function canManageMonthlySupport(userId: string): Promise<boolean | null> {
  try {
    return Boolean(await findSupporterSubscriptionCustomer(userId));
  } catch {
    return null;
  }
}

export default async function SupportPage() {
  const session = await getSession();
  const checkoutEnabled = stripeEnabled();
  const monthlyStatus = session && checkoutEnabled ? await canManageMonthlySupport(session.user.id) : false;
  const showPortal = monthlyStatus === true;
  return (
    <main id="main-content" className="page-shell page-shell--narrow donation-page">
      <header className="page-heading donation-heading"><p className="eyebrow">Support PostMineClan</p><h1>好きを創る活動を、支える。</h1><p>サポーターからいただく支援金は、PostMineClanのWebサイト運営や制作活動を続けるために活用します。</p></header>
      <section className="donation-usage" aria-labelledby="support-usage-title"><div className="donation-section-heading"><p className="eyebrow">How we use it</p><h2 id="support-usage-title">支援金の主な用途</h2></div><div className="donation-usage__grid"><article><span aria-hidden="true">01</span><h3>Minecraftサーバーの運営維持</h3><p>メンバーが安心して遊び、活動できるMinecraftサーバーの維持費に使用します。</p></article><article><span aria-hidden="true">02</span><h3>Webサイトの運営</h3><p>活動記録を公開するWebサイトのサーバー、ドメイン、ストレージなどの維持費に使用します。</p></article><article><span aria-hidden="true">03</span><h3>コミュニティの継続</h3><p>メンバーが安心して創作と発信を続けられる場所づくりに役立てます。</p></article></div></section>
      <aside className="donation-policy" aria-label="支援に関する注意事項"><h2>お申し込み前にご確認ください</h2><ul>{SUPPORTER_POLICY.map((condition) => <li key={condition}>{condition}</li>)}<li>StripeでPayPayが有効な場合、1回支援ではPayPayを選択できます。月額サポーターではPayPayをご利用いただけません。</li><li>本制度の支援金について、税制上の控除に必要な領収書は発行できません。</li></ul><p>返金・契約についてのご相談は<Link href="/contact">お問い合わせフォーム</Link>をご利用ください。</p></aside>
      <section className="donation-card" aria-labelledby="support-form-title"><div className="donation-card__intro"><span className="donation-card__icon" aria-hidden="true">♡</span><div><p className="eyebrow">Choose your support</p><h2 id="support-form-title">支援方法を選ぶ</h2></div></div><SupportForm checkoutEnabled={checkoutEnabled} loggedIn={Boolean(session)} monthlyStatus={monthlyStatus === null ? "unknown" : monthlyStatus ? "existing" : "none"} />{showPortal ? <form action="/api/supporters/portal" method="post"><button className="button button--ghost button--full" type="submit">支払い方法・月額プランを管理</button></form> : null}</section>
    </main>
  );
}
