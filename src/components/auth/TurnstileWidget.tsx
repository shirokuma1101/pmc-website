"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";
type TurnstileAction = "login" | "registration" | "google-sso" | "x-sso" | "password-reset-request";

// Cloudflare's documented local-development test credentials. The matching
// server-side secret accepts this token without contacting the live challenge.
const LOCAL_TEST_SITEKEY = "1x00000000000000000000AA";
const LOCAL_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  action: TurnstileAction;
  onTokenChange: (token: string | null) => void;
  resetKey?: number;
}

export function TurnstileWidget({ action, onTokenChange, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const callbackRef = useRef(onTokenChange);
  const [widgetError, setWidgetError] = useState(false);
  const id = useId();
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const usesLocalTestKey = sitekey === LOCAL_TEST_SITEKEY;

  useEffect(() => {
    callbackRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!usesLocalTestKey) return;
    callbackRef.current(LOCAL_TEST_TOKEN);
    return () => callbackRef.current(null);
  }, [resetKey, usesLocalTestKey]);

  function renderWidget(): boolean {
    if (!sitekey || !containerRef.current || !window.turnstile || widgetIdRef.current) return false;
    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey,
        action,
        theme: "auto",
        size: "flexible",
        appearance: "always",
        callback: (token: string) => {
          setWidgetError(false);
          callbackRef.current(token);
        },
        "expired-callback": () => {
          callbackRef.current(null);
          if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
        },
        "error-callback": () => {
          setWidgetError(true);
          callbackRef.current(null);
        },
        "unsupported-callback": () => {
          setWidgetError(true);
          callbackRef.current(null);
        },
      });
      return true;
    } catch {
      setWidgetError(true);
      callbackRef.current(null);
      return false;
    }
  }

  useEffect(() => {
    if (usesLocalTestKey) return;
    let attempts = 0;
    const tryRender = () => {
      attempts += 1;
      if (renderWidget()) {
        clearInterval(interval);
      } else if (attempts >= 100) {
        clearInterval(interval);
        setWidgetError(true);
      }
    };
    const interval = window.setInterval(tryRender, 100);
    tryRender();

    return () => {
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
      callbackRef.current(null);
    };
  // `action` and `sitekey` define the lifetime of the external widget instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, sitekey, usesLocalTestKey]);

  useEffect(() => {
    if (!usesLocalTestKey && resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      callbackRef.current(null);
    }
  }, [resetKey, usesLocalTestKey]);

  return (
    <div className="turnstile-field" aria-labelledby={`${id}-label`}>
      <span className="sr-only" id={`${id}-label`}>セキュリティ確認</span>
      {usesLocalTestKey ? <p className="field__hint">ローカル開発用のセキュリティ確認を使用中です。</p> : <>
        <Script
          id="cloudflare-turnstile"
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={() => undefined}
          onError={() => {
            setWidgetError(true);
            callbackRef.current(null);
          }}
        />
        <div ref={containerRef} />
      </>}
      {!sitekey || widgetError ? <p className="field__error">セキュリティ確認を読み込めませんでした。ページを再読み込みしてください。</p> : null}
    </div>
  );
}
