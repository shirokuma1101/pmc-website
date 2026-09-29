"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "@/components/apiResponse";
import { Alert } from "@/components/ui";
import { MONTHLY_SUPPORTER_PLANS, ONE_TIME_SUPPORT, type MonthlySupporterTier } from "@/lib/organization/supporter";

export interface SupportFormProps { checkoutEnabled: boolean; loggedIn: boolean; monthlyStatus?: "none" | "existing" | "unknown"; currentTier?: MonthlySupporterTier }

const monthlyBenefits = [
  { label: "プロフィールに表示されるバッジ", match: "バッジ" },
  { label: "メンバー一覧でサポーターとして表示", match: "メンバー一覧" },
  { label: "地図の時系列比較を利用可能", match: "地図の時系列比較" },
] as const;
const plannedBenefits = [
  { label: "Webサイト新規機能のアーリーアクセス", tiers: ["basic", "standard", "premium"] },
  { label: "Discord bot新規コマンドのアーリーアクセス", tiers: ["basic", "standard", "premium"] },
  { label: "会員限定コンテンツへのアクセス", tiers: ["standard", "premium"] },
  { label: "BlueMap(3Dマップ)の利用", tiers: ["premium"] },
] as const;
const plans = [
  { key: ONE_TIME_SUPPORT.tier, label: "Supporter", amount: ONE_TIME_SUPPORT.amount, frequency: "one_time" as const, badge: "Supporterバッジ（支援回数で変化）", benefits: [...ONE_TIME_SUPPORT.benefits] },
  ...Object.entries(MONTHLY_SUPPORTER_PLANS).map(([key, plan]) => ({
    key: key as MonthlySupporterTier, label: plan.label, amount: plan.amount,
    frequency: "monthly" as const,
    badge: plan.benefits.find((item) => item.includes("バッジ"))?.replace("（非表示設定可）", "") ?? "—",
    benefits: [...plan.benefits],
  })),
];

export function SupportForm({ checkoutEnabled, loggedIn, monthlyStatus = "none", currentTier }: SupportFormProps) {
  const [tier, setTier] = useState<MonthlySupporterTier | typeof ONE_TIME_SUPPORT.tier>("standard");
  const frequency = tier === ONE_TIME_SUPPORT.tier ? "one_time" : "monthly";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [consent, setConsent] = useState(false);
  const attempt = useRef<{ selection: string; id: string } | null>(null);
  const switching = frequency === "monthly" && monthlyStatus === "existing";
  const monthlyBlocked = frequency === "monthly" && (monthlyStatus === "unknown" || (switching && (!currentTier || tier === currentTier)));
  const selectedPlan = tier === ONE_TIME_SUPPORT.tier ? ONE_TIME_SUPPORT : MONTHLY_SUPPORTER_PLANS[tier];

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
      <input name="frequency" type="hidden" value={frequency} />

        <fieldset className="donation-form__fieldset">
          <legend>サポートプランを選ぶ</legend>
          <p className="support-plan-lead">プランごとの支払い方式と特典を比較できます。「提供予定」の特典は現在まだ利用できません。PayPayは単発サポートでご利用いただけます。</p>
          <div className="support-comparison-scroll">
            <table className="support-comparison">
              <caption>サポートプランの比較と選択</caption>
              <thead><tr>
                <th scope="col">項目</th>
                {plans.map((plan) => (
                  <th data-selected={tier === plan.key} key={plan.key} scope="col">
                    <label className="support-comparison__choice">
                      <input checked={tier === plan.key} name="tier" onChange={() => setTier(plan.key)} type="radio" value={plan.key} />
                      <strong>{plan.label}</strong>
                      <span>¥{plan.amount.toLocaleString("ja-JP")} <small>（税込）{plan.frequency === "monthly" ? "/ 月" : ""}</small></span>
                      <span className="support-comparison__select">{tier === plan.key ? "選択中" : "選択する"}</span>
                    </label>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                <tr><th scope="row">支払い方式</th>{plans.map((plan) => <td data-selected={tier === plan.key} key={plan.key}>{plan.frequency === "monthly" ? "月額・自動更新" : "1回のみ・自動更新なし"}</td>)}</tr>
                {monthlyBenefits.map((benefit) => (
                  <tr key={benefit.label}>
                    <th scope="row">{benefit.label}</th>
                    {plans.map((plan) => {
                      if (benefit.match === "バッジ") {
                        return <td data-selected={tier === plan.key} key={plan.key}><span className="support-comparison__badge">{plan.badge}</span></td>;
                      }
                      const available = plan.benefits.some((item) => item.includes(benefit.match));
                      return <td data-selected={tier === plan.key} key={plan.key}><span aria-label={available ? "利用可能" : "対象外"} className={available ? "support-comparison__yes" : "support-comparison__no"}>{available ? "✓" : "—"}</span></td>;
                    })}
                  </tr>
                ))}
                {plannedBenefits.map((benefit) => (
                  <tr key={benefit.label}>
                    <th scope="row">{benefit.label}</th>
                    {plans.map((plan) => {
                      const planned = benefit.tiers.some((tier) => tier === plan.key);
                      return <td data-selected={tier === plan.key} key={plan.key}><span aria-label={planned ? "提供予定" : "対象外"} className={planned ? "support-comparison__planned" : "support-comparison__no"}>{planned ? "提供予定" : "—"}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="support-comparison-mobile">
            <div className="support-comparison-mobile__plans" role="group" aria-label="サポートプラン">
              {plans.map((plan) => (
                <button aria-pressed={tier === plan.key} className="support-comparison-mobile__plan" key={plan.key} onClick={() => setTier(plan.key)} type="button">
                  <strong>{plan.label}</strong>
                  <span>¥{plan.amount.toLocaleString("ja-JP")}{plan.frequency === "monthly" ? " / 月" : " / 回"}</span>
                  <span>{plan.frequency === "monthly" ? "月額" : "1回のみ"}</span>
                  {tier === plan.key ? <span aria-hidden="true" className="support-comparison-mobile__check">✓</span> : null}
                </button>
              ))}
            </div>
            <dl className="support-comparison-mobile__details">
              <div><dt>支払い方式</dt><dd>{frequency === "monthly" ? "月額・自動更新" : "1回のみ・自動更新なし"}</dd></div>
              <div><dt>プロフィールに表示されるバッジ</dt><dd>{plans.find((plan) => plan.key === tier)?.badge}</dd></div>
              {monthlyBenefits.filter((benefit) => benefit.match !== "バッジ").map((benefit) => {
                const available = plans.find((plan) => plan.key === tier)?.benefits.some((item) => item.includes(benefit.match));
                return <div key={benefit.label}><dt>{benefit.label}</dt><dd>{available ? "✓ 利用可能" : "— 対象外"}</dd></div>;
              })}
              {plannedBenefits.map((benefit) => {
                const planned = benefit.tiers.some((planTier) => planTier === tier);
                return <div key={benefit.label}><dt>{benefit.label}</dt><dd className={planned ? "support-comparison__planned" : undefined}>{planned ? "提供予定" : "— 対象外"}</dd></div>;
              })}
            </dl>
          </div>
          {!loggedIn ? <p className="donation-form__notice" role="status">サポーターバッジ・特典の付与にはログインが必要です。</p> : null}
        </fieldset>

      <p className="donation-form__notice" aria-live="polite">お申し込み内容：{frequency === "monthly" ? selectedPlan.label : "Supporter"} 1件・{frequency === "monthly" ? `初回・2回目以降とも毎月¥${selectedPlan.amount.toLocaleString("ja-JP")}（税込・解約まで自動更新）` : `¥${selectedPlan.amount.toLocaleString("ja-JP")}（税込）の1回決済（自動更新なし）`}</p>
      {switching && currentTier ? <Alert>現在の{MONTHLY_SUPPORTER_PLANS[currentTier].label}から切り替えます。<Link href="/me">マイページで現在のプランを確認</Link>できます。新プランは申込日に全額を請求し、旧プランは現在の支払済み期間の終了日に解約します。重複期間の返金はなく、上位プランの特典を適用します。決済を完了しない場合は旧プランを維持します。</Alert> : null}
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
