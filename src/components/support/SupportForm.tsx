"use client";

import { useState } from "react";
import { MAX_ONE_TIME_SUPPORT_QUANTITY, MONTHLY_SUPPORTER_PLANS, ONE_TIME_SUPPORT, type MonthlySupporterTier } from "@/lib/organization/supporter";

export interface SupportFormProps { checkoutEnabled: boolean; loggedIn: boolean }

export function SupportForm({ checkoutEnabled, loggedIn }: SupportFormProps) {
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("monthly");
  const [tier, setTier] = useState<MonthlySupporterTier>("standard");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form className="donation-form" action="/api/supporters/checkout" method="post" onSubmit={() => setSubmitting(true)}>
      <div className="donation-frequency" role="group" aria-label="支援方法">
        <button aria-pressed={frequency === "monthly"} className={frequency === "monthly" ? "is-active" : undefined} onClick={() => setFrequency("monthly")} type="button">月額サポーター</button>
        <button aria-pressed={frequency === "one_time"} className={frequency === "one_time" ? "is-active" : undefined} onClick={() => setFrequency("one_time")} type="button">1回の支援</button>
      </div>
      <input name="frequency" type="hidden" value={frequency} />

      {frequency === "monthly" ? (
        <fieldset className="donation-form__fieldset">
          <legend>月額プランを選ぶ</legend>
          <p className="support-plan-lead">毎月の支援額に合わせて、プロフィールにサポーターバッジが表示されます。</p>
          <div className="donation-amounts donation-amounts--plans">
            {Object.entries(MONTHLY_SUPPORTER_PLANS).map(([key, plan]) => (
              <label className="donation-amount support-plan" key={key}>
                <input checked={tier === key} name="tier" onChange={() => setTier(key as MonthlySupporterTier)} type="radio" value={key} />
                <span className="donation-amount__surface">
                  <strong>{plan.label}</strong>
                  <span className="support-plan__price"><b>¥{plan.amount.toLocaleString("ja-JP")}</b><small>/ 月</small></span>
                  <span className="support-plan__description">{plan.description}</span>
                  <span className="support-plan__check" aria-hidden="true">✓</span>
                </span>
              </label>
            ))}
          </div>
          {!loggedIn ? <p className="donation-form__notice" role="status">月額サポーターへの加入にはログインが必要です。</p> : null}
        </fieldset>
      ) : (
        <fieldset className="donation-form__fieldset">
          <legend>1回支援プラン</legend>
          <p className="support-plan-lead">800円でStandard Supporter特典を1か月利用できます。個数分だけ有効期間が延長されます。</p>
          <div className="donation-amounts donation-amounts--one-time">
            <label className="donation-amount support-plan support-plan--one-time"><input defaultChecked name="tier" type="radio" value={ONE_TIME_SUPPORT.tier} /><span className="donation-amount__surface"><strong>Standard Supporter</strong><span className="support-plan__price"><b>¥{ONE_TIME_SUPPORT.amount.toLocaleString("ja-JP")}</b><small>/ 1か月</small></span><span className="support-plan__description">自動更新なしの買い切りプラン</span><span className="support-plan__check" aria-hidden="true">✓</span></span></label>
          </div>
          <div className="donation-custom-amount">
            <label className="donation-custom-amount__label" htmlFor="support-quantity">有効月数</label>
            <span className="donation-custom-amount__input">
              <input id="support-quantity" inputMode="numeric" max={MAX_ONE_TIME_SUPPORT_QUANTITY} min={1} name="quantity" onChange={(event) => setQuantity(Number(event.target.value))} required step={1} type="number" value={quantity} />
              <span>か月</span>
            </span>
            <small>1〜{MAX_ONE_TIME_SUPPORT_QUANTITY}か月・合計 ¥{(ONE_TIME_SUPPORT.amount * (Number.isSafeInteger(quantity) ? quantity : 0)).toLocaleString("ja-JP")}</small>
          </div>
          {!loggedIn ? <p className="donation-form__notice" role="status">Standard Supporter特典の付与にはログインが必要です。</p> : null}
        </fieldset>
      )}

      <label className="donation-consent"><input name="consent" required type="checkbox" value="accepted" /><span>支援金の用途と返金方針を確認し、Stripeの決済画面へ移動することに同意します。</span></label>
      <button className="button button--primary button--lg button--full" disabled={!checkoutEnabled || submitting || !loggedIn} type="submit">{submitting ? "Stripeへ移動しています…" : frequency === "monthly" ? "サポーターになる" : "Standard Supporterになる"}</button>
      {!checkoutEnabled ? <p className="donation-form__notice" role="status">現在、決済機能を準備しています。Stripeの設定完了後にご利用いただけます。</p> : null}
      <p className="donation-form__secure-note">カード情報はPostMineClanでは保持せず、Stripeの安全な決済画面で入力します。{frequency === "monthly" ? " 月額プランは解約するまで自動で継続します。" : null}</p>
    </form>
  );
}
