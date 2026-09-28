import Link from "next/link";
import { MONTHLY_SUPPORTER_PLANS, ONE_TIME_SUPPORT } from "@/lib/organization/supporter";
import { SUPPORTER_POLICY } from "@/lib/organization/supporter-policy";

export const metadata = { title: "特定商取引法に基づく表記" };

export default function CommercialTransactionsPage() {
  return (
    <main id="main-content" className="legal-page page-shell page-shell--narrow">
      <header className="legal-page__header">
        <p className="eyebrow">Commercial transactions</p>
        <h1>特定商取引法に基づく表記</h1>
        <p>PostMineClanのサポーター制度に関するご案内です。</p>
      </header>

      <section aria-labelledby="commercial-operator-title">
        <h2 id="commercial-operator-title">販売主体・お問い合わせ先</h2>
        <dl className="legal-disclosure-list">
          <div><dt>販売事業者</dt><dd>Takuma Shirooka</dd></div>
          <div><dt>所在地</dt><dd><address>Shukugawara Y2 Corporas, Room 101<br />3-5-45 Shukugawara, Tama-ku<br />Kawasaki-shi, Kanagawa, Japan</address></dd></div>
          <div><dt>電話番号</dt><dd>090-8707-7590</dd></div>
          <div><dt>お問い合わせ</dt><dd><Link href="/contact">お問い合わせフォーム</Link>（管理者宛：support@postmineclan.com）</dd></div>
        </dl>
      </section>

      <section aria-labelledby="commercial-conditions-title">
        <h2 id="commercial-conditions-title">サポーター制度の条件</h2>
        <dl className="legal-disclosure-list">
          <div><dt>料金</dt><dd>単発サポート：{ONE_TIME_SUPPORT.amount}円（税込）。月額：Basic {MONTHLY_SUPPORTER_PLANS.basic.amount}円（税込）、Standard {MONTHLY_SUPPORTER_PLANS.standard.amount}円（税込）、Premium {MONTHLY_SUPPORTER_PLANS.premium.amount.toLocaleString("ja-JP")}円（税込）。</dd></div>
          <div><dt>料金以外の費用</dt><dd>表示額以外に当方から請求する費用はありません。</dd></div>
          <div><dt>お支払い方法</dt><dd>Stripeで有効化されている方法のうち、選択したプランで利用できる方法が決済画面に表示されます。単発サポートと月額では利用可能な方法が異なります。</dd></div>
          <div><dt>お支払い時期</dt><dd>単発サポートはお申し込み時に1回決済します。月額はお申し込み時と、解約するまで毎月請求します。プラン切替時は新プランをお申し込み日に全額請求します。</dd></div>
          <div><dt>提供時期</dt><dd>決済完了をStripeから確認した後、対象のバッジ・特典をアカウントに反映します。</dd></div>
          <div><dt>解約・返金</dt><dd>下記の条件をご確認ください。月額契約の解約と支払い方法の変更は、マイページからStripeの管理画面へ進んでお手続きいただけます。</dd></div>
        </dl>
        <ul>{SUPPORTER_POLICY.map((condition) => <li key={condition}>{condition}</li>)}</ul>
        <p>プランごとの特典とお申し込み内容は<Link href="/supporters">サポーターページ</Link>でご確認いただけます。</p>
      </section>
    </main>
  );
}
