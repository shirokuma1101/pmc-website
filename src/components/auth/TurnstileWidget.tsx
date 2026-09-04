"use client";

import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";
type TurnstileAction = "login" | "registration" | "google-sso" | "x-sso" | "password-reset-request";

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

  useEffect(() => {
    callbackRef.current = onTokenChange;
  }, [onTokenChange]);

  const renderWidget = useCallback(() => {
    if (!sitekey || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
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
    } catch {
      setWidgetError(true);
      callbackRef.current(null);
    }
  }, [action, sitekey]);

  useEffect(() => () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
      callbackRef.current(null);
  }, []);

  useEffect(() => {
    if (resetKey > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      callbackRef.current(null);
    }
  }, [resetKey]);

  return (
    <div className="turnstile-field" aria-labelledby={`${id}-label`}>
      <span className="sr-only" id={`${id}-label`}>セキュリティ確認</span>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => {
          setWidgetError(true);
          callbackRef.current(null);
        }}
      />
      <div ref={containerRef} />
      {!sitekey || widgetError ? <p className="field__error">セキュリティ確認を読み込めませんでした。ページを再読み込みしてください。</p> : null}
    </div>
  );
}
