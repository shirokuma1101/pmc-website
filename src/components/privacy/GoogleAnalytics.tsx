"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_KEY,
  type CookieConsentChoice,
} from "./CookieConsent";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

function consentChoice(): CookieConsentChoice | null {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "necessary" || value === "all" ? value : null;
  } catch {
    return null;
  }
}

function removeAnalyticsCookies() {
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0]?.trim();
    if (name === "_ga" || name?.startsWith("_ga_")) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  });
}

export function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const validId = measurementId && /^G-[A-Z0-9]+$/i.test(measurementId) ? measurementId : null;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!validId) return;
    const analyticsWindow = window as unknown as AnalyticsWindow;
    const applyChoice = (choice: CookieConsentChoice | null) => {
      const granted = choice === "all";
      analyticsWindow[`ga-disable-${validId}`] = !granted;
      analyticsWindow.gtag?.("consent", "update", {
        analytics_storage: granted ? "granted" : "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      if (!granted) removeAnalyticsCookies();
      setEnabled(granted);
    };

    const initialApply = window.setTimeout(() => applyChoice(consentChoice()), 0);
    const handleChange = (event: Event) => {
      applyChoice((event as CustomEvent<CookieConsentChoice>).detail);
    };
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, handleChange);
    return () => {
      window.clearTimeout(initialApply);
      window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, handleChange);
    };
  }, [validId]);

  if (!validId || !enabled) return null;

  return (
    <>
      <Script
        id="google-analytics"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(validId)}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config','${validId}');`}
      </Script>
    </>
  );
}
