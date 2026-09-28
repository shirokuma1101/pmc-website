"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const themeEvent = "pmc-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(themeEvent, onChange);
  return () => window.removeEventListener(themeEvent, onChange);
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeSelector() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null);

  function selectTheme(nextTheme: Theme) {
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.dispatchEvent(new Event(themeEvent));
    try {
      localStorage.setItem("pmc-theme", nextTheme);
    } catch {
      // The selected mode remains active when browser storage is unavailable.
    }
  }

  return (
    <div className="site-footer__appearance" role="group" aria-label="表示モード">
      <div className="site-footer__theme-options">
        <button type="button" aria-pressed={theme === "light"} onClick={() => selectTheme("light")}>☀ ライト</button>
        <button type="button" aria-pressed={theme === "dark"} onClick={() => selectTheme("dark")}>☾ ダーク</button>
      </div>
    </div>
  );
}
