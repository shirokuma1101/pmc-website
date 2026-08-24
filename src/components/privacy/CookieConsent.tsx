"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export const COOKIE_CONSENT_KEY = "pmc-cookie-consent-v2";
export const OPEN_COOKIE_SETTINGS_EVENT = "pmc:open-cookie-settings";
export const COOKIE_CONSENT_CHANGED_EVENT = "pmc:cookie-consent-changed";

export type CookieConsentChoice = "necessary" | "all";

function storedChoice(): CookieConsentChoice | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "necessary" || value === "all" ? value : null;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => setOpen(storedChoice() === null), 0);
    const showSettings = () => setOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, showSettings);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, showSettings);
    };
  }, []);

  function save(choice: CookieConsentChoice) {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, choice);
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: choice }));
    } finally {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <section className="cookie-consent" aria-labelledby="cookie-consent-title" aria-live="polite">
      <div className="cookie-consent__copy">
        <p className="eyebrow">COOKIE SETTINGS</p>
        <h2 id="cookie-consent-title">Cookieの利用について</h2>
        <p>
          ログイン状態や安全な操作に必要なCookie・保存領域を使用します。「すべて許可」を選ぶと、
          サイトの利用状況を把握して改善するためにGoogle Analyticsを使用します。広告目的では使用しません。
        </p>
        <p className="cookie-consent__links">
          <Link href="/privacy">プライバシーポリシー</Link>
          <span aria-hidden="true">・</span>
          <Link href="/terms">利用規約</Link>
        </p>
      </div>
      <div className="cookie-consent__actions">
        <Button type="button" variant="secondary" onClick={() => save("necessary")}>任意Cookieを許可しない</Button>
        <Button type="button" onClick={() => save("all")}>すべて許可</Button>
      </div>
    </section>
  );
}

export function CookieSettingsButton() {
  return (
    <button
      className="site-footer__link-button"
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}
    >
      Cookie設定
    </button>
  );
}
