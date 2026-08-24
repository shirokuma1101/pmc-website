import type { Metadata } from "next";
import { DonationForm } from "@/components/donation";

export const metadata: Metadata = {
  title: "活動を支援する",
  description: "PostMineClanの活動を寄付で支援するためのご案内です。",
};

export default function DonatePage() {
  return (
    <main id="main-content" className="page-shell page-shell--narrow donation-page">
      <header className="page-heading donation-heading">
        <p className="eyebrow">Support PostMineClan</p>
        <h1>好きを創る活動を、支える。</h1>
        <p>
          いただいた寄付は、PostMineClanのWebサイト運営や制作活動を続けるために活用します。
        </p>
      </header>

      <section className="donation-card" aria-labelledby="donation-form-title">
        <div className="donation-card__intro">
          <span className="donation-card__icon" aria-hidden="true">♡</span>
          <div>
            <p className="eyebrow">Choose your support</p>
            <h2 id="donation-form-title">寄付方法を選ぶ</h2>
          </div>
        </div>
        <DonationForm />
      </section>

      <section className="donation-usage" aria-labelledby="donation-usage-title">
        <div className="donation-section-heading">
          <p className="eyebrow">How we use it</p>
          <h2 id="donation-usage-title">寄付金の主な用途</h2>
        </div>
        <div className="donation-usage__grid">
          <article>
            <span aria-hidden="true">01</span>
            <h3>Minecraftサーバーの運営維持</h3>
            <p>メンバーが安心して遊び、活動できるMinecraftサーバーの維持費に使用します。</p>
          </article>
          <article>
            <span aria-hidden="true">02</span>
            <h3>Webサイトの運営</h3>
            <p>活動記録を公開するWebサイトのサーバー、ドメイン、ストレージなどの維持費に使用します。</p>
          </article>
          <article>
            <span aria-hidden="true">03</span>
            <h3>コミュニティの継続</h3>
            <p>メンバーが安心して創作と発信を続けられる場所づくりに役立てます。</p>
          </article>
        </div>
      </section>

      <aside className="donation-policy" aria-label="寄付に関する注意事項">
        <h2>寄付の前にご確認ください</h2>
        <ul>
          <li>寄付は任意であり、サービスや特典の購入ではありません。</li>
          <li>毎月の寄付は解約するまで自動更新され、同じ金額が毎月決済されます。</li>
          <li>決済完了後の返金は、重複決済など個別に確認できる場合を除き原則として受け付けません。</li>
          <li>寄付金控除の対象となる領収書は発行できません。</li>
          <li>正式な運営主体、問い合わせ先、寄付規約は決済受付を開始する前に掲載します。</li>
        </ul>
      </aside>
    </main>
  );
}
