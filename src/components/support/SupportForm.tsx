"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "@/components/apiResponse";
import { Alert } from "@/components/ui";
import { MONTHLY_SUPPORTER_PLANS, ONE_TIME_SUPPORT, type MonthlySupporterTier } from "@/lib/organization/supporter";

export interface SupportFormProps { checkoutEnabled: boolean; loggedIn: boolean; monthlyStatus?: "none" | "existing" | "unknown"; currentTier?: MonthlySupporterTier }

export function SupportForm({ checkoutEnabled, loggedIn, monthlyStatus = "none", currentTier }: SupportFormProps) {
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("monthly");
  const [tier, setTier] = useState<MonthlySupporterTier>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const attempt = useRef<{ selection: string; id: string } | null>(null);
  const switching = frequency === "monthly" && monthlyStatus === "existing";
  const monthlyBlocked = frequency === "monthly" && (monthlyStatus === "unknown" || (switching && (!currentTier || tier === currentTier)));
  const selectedPlan = frequency === "monthly" ? MONTHLY_SUPPORTER_PLANS[tier] : ONE_TIME_SUPPORT;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || monthlyBlocked || !adultConfirmed || !consent) return;
    const body = new FormData(event.currentTarget);
    const selection = `${frequency}/${tier}`;
    if (attempt.current?.selection !== selection) attempt.current = { selection, id: crypto.randomUUID() };
    body.set("requestId", attempt.current.id);
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(switching ? "/api/supporters/switch" : "/api/supporters/checkout", { method: "POST", body, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, "決済画面を開けませんでした。時間をおいて再度お試しください。"));
      const result = await response.json() as { data?: { url?: string } };
      if (!result.data?.url) throw new Error("決済画面を開けませんでした。");
      window.location.assign(result.data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "決済画面を開けませんでした。");
      setSubmitting(false);
    }
  }

  return (
    <form className="donation-form" action="/api/supporters/checkout" method="post" onSubmit={submit}>
      <div className="donation-frequency" role="group" aria-label="支援方法">
        <button aria-pressed={frequency === "monthly"} className={frequency === "monthly" ? "is-active" : undefined} onClick={() => setFrequency("monthly")} type="button">月額サポーター</button>
        <button aria-pressed={frequency === "one_time"} className={frequency === "one_time" ? "is-active" : undefined} onClick={() => setFrequency("one_time")} type="button">1回の支援</button>
      </div>
      <input name="frequency" type="hidden" value={frequency} />

      {frequency === "monthly" ? (
        <fieldset className="donation-form__fieldset">
          <legend>月額プランを選ぶ</legend>
          <p className="support-plan-lead">毎月の支援額に合わせて、プロフィールにサポーターバッジが表示されます。PayPayをご希望の場合は、1回支援をご利用ください。</p>
          <div className="donation-amounts donation-amounts--plans">
            {Object.entries(MONTHLY_SUPPORTER_PLANS).map(([key, plan]) => (
              <label className="donation-amount support-plan" key={key}>
                <input checked={tier === key} name="tier" onChange={() => setTier(key as MonthlySupporterTier)} type="radio" value={key} />
                <span className="donation-amount__surface">
                  <strong>{plan.label}</strong>
                  <span className="support-plan__price"><b>¥{plan.amount.toLocaleString("ja-JP")}</b><small>（税込）/ 月</small></span>
                  <ul className="support-plan__benefits">
                    {plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
                  </ul>
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
          <p className="support-plan-lead">300円（税込）で活動を支援し、プロフィールにSupporterバッジを表示できます。追加特典や自動更新はありません。</p>
          <div className="donation-amounts donation-amounts--one-time">
            <label className="donation-amount support-plan support-plan--one-time"><input defaultChecked name="tier" type="radio" value={ONE_TIME_SUPPORT.tier} /><span className="donation-amount__surface"><strong>Supporter</strong><span className="support-plan__price"><b>¥{ONE_TIME_SUPPORT.amount.toLocaleString("ja-JP")}</b><small>（税込）</small></span><span className="support-plan__description">{ONE_TIME_SUPPORT.description}</span><span className="support-plan__check" aria-hidden="true">✓</span></span></label>
          </div>
          {!loggedIn ? <p className="donation-form__notice" role="status">Supporterバッジ・特典の付与にはログインが必要です。</p> : null}
        </fieldset>
      )}

      <p className="donation-form__notice" aria-live="polite">お申し込み内容：{frequency === "monthly" ? selectedPlan.label : "Supporter"} 1件・{frequency === "monthly" ? `初回・2回目以降とも毎月¥${selectedPlan.amount.toLocaleString("ja-JP")}（税込・解約まで自動更新）` : `¥${selectedPlan.amount.toLocaleString("ja-JP")}（税込）の1回決済（自動更新なし）`}</p>
      {switching && currentTier ? <Alert>現在の{MONTHLY_SUPPORTER_PLANS[currentTier].label}から切り替えます。新プランは申込日に全額を請求し、旧プランは現在の支払済み期間の終了日に解約します。重複期間の返金はなく、上位プランの特典を適用します。決済を完了しない場合は旧プランを維持します。</Alert> : null}
      {monthlyBlocked ? <Alert>{switching ? currentTier ? "現在と異なるプランを選んでください。" : "切替可能な契約を確認できません。下の管理画面で契約状況をご確認ください。" : "契約状況を確認できませんでした。時間をおいてページを再読み込みしてください。"}</Alert> : null}
      {error ? <Alert tone="error">{error} <Link href="/contact">お問い合わせ</Link></Alert> : null}
      <label className="donation-consent"><input checked={adultConfirmed} name="adultConfirmed" onChange={(event) => setAdultConfirmed(event.target.checked)} required type="checkbox" value="accepted" /><span>私は18歳以上です。未成年者はお申し込みいただけません。</span></label>
      <label className="donation-consent"><input checked={consent} name="consent" onChange={(event) => setConsent(event.target.checked)} required type="checkbox" value="accepted" /><span>上記の支払・特典・返金・解約条件と<Link href="/terms" target="_blank">利用規約</Link>を確認し、Stripeの決済画面へ移動することに同意します。</span></label>
      <button className="button button--primary button--lg button--full" disabled={!checkoutEnabled || submitting || !loggedIn || monthlyBlocked || !adultConfirmed || !consent} type="submit">{submitting ? "Stripeへ移動しています…" : switching ? "新プランに申し込む" : frequency === "monthly" ? "サポーターになる" : "Supporterとして支援する"}</button>
      {!checkoutEnabled ? <p className="donation-form__notice" role="status">現在、決済機能を準備しています。Stripeの設定完了後にご利用いただけます。</p> : null}
      <p className="donation-form__secure-note">カード情報はPostMineClanでは保持せず、Stripeの安全な決済画面で入力します。{frequency === "monthly" ? " 月額プランは解約するまで自動で継続します。" : null}</p>
    </form>
  );
}
