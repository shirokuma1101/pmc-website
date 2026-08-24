"use client";

import { useState } from "react";

const donationAmounts = [500, 1_000, 2_500, 5_000] as const;

export interface DonationFormProps {
  checkoutEnabled?: boolean;
}

export function DonationForm({ checkoutEnabled = false }: DonationFormProps) {
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("one_time");
  const [amount, setAmount] = useState<string>("1000");

  function selectFrequency(nextFrequency: "one_time" | "monthly") {
    setFrequency(nextFrequency);
    if (nextFrequency === "monthly" && amount === "custom") setAmount("1000");
  }

  return (
    <form className="donation-form" action="/api/donations/checkout" method="post">
      <div className="donation-frequency" role="group" aria-label="寄付の頻度">
        <button
          aria-pressed={frequency === "one_time"}
          className={frequency === "one_time" ? "is-active" : undefined}
          onClick={() => selectFrequency("one_time")}
          type="button"
        >
          1回限り
        </button>
        <button
          aria-pressed={frequency === "monthly"}
          className={frequency === "monthly" ? "is-active" : undefined}
          onClick={() => selectFrequency("monthly")}
          type="button"
        >
          毎月の寄付
        </button>
      </div>
      <input name="frequency" type="hidden" value={frequency} />

      {frequency === "monthly" ? (
        <div className="donation-form__monthly-note">
          <strong>毎月、選択した金額で活動を支援します</strong>
          <span>Stripeからいつでも支払い方法の変更や解約ができます。</span>
        </div>
      ) : null}

      <fieldset className="donation-form__fieldset">
        <legend>{frequency === "monthly" ? "毎月の寄付金額を選ぶ" : "寄付金額を選ぶ"}</legend>
        <div className="donation-amounts">
          {donationAmounts.map((donationAmount) => (
            <label className="donation-amount" key={donationAmount}>
              <input
                checked={amount === String(donationAmount)}
                name="amount"
                onChange={() => setAmount(String(donationAmount))}
                type="radio"
                value={donationAmount}
              />
              <span>¥{donationAmount.toLocaleString("ja-JP")}</span>
            </label>
          ))}
        </div>
        {frequency === "one_time" ? (
          <div className="donation-custom-amount">
            <label className="donation-custom-amount__label">
              <input
                checked={amount === "custom"}
                name="amount"
                onChange={() => setAmount("custom")}
                type="radio"
                value="custom"
              />
              <span>任意の金額</span>
            </label>
            <span className="donation-custom-amount__input">
              <span aria-hidden="true">¥</span>
              <input
                aria-label="任意の寄付金額"
                disabled={amount !== "custom"}
                inputMode="numeric"
                max={10_000}
                min={300}
                name="custom_amount"
                onFocus={() => setAmount("custom")}
                placeholder="例: 2,500"
                required={amount === "custom"}
                step={1}
                type="number"
              />
            </span>
            <small>300円〜10,000円・整数で入力</small>
          </div>
        ) : null}
      </fieldset>

      <label className="donation-consent">
        <input name="consent" required type="checkbox" value="accepted" />
        <span>
          寄付金の用途と返金方針を確認し、Stripeの決済画面へ移動することに同意します。
        </span>
      </label>

      <button
        className="button button--primary button--lg button--full"
        disabled={!checkoutEnabled}
        type="submit"
      >
        {frequency === "monthly" ? "毎月の寄付を始める" : "Stripeで寄付する"}
      </button>

      {!checkoutEnabled ? (
        <p className="donation-form__notice" role="status">
          現在、決済機能を準備しています。Stripeとの接続完了後にご利用いただけます。
        </p>
      ) : null}
      <p className="donation-form__secure-note">
        カード情報はPostMineClanでは保持せず、Stripeの安全な決済画面で入力します。
        {frequency === "monthly" ? " 毎月の寄付は解約するまで自動で継続します。" : null}
      </p>
    </form>
  );
}
