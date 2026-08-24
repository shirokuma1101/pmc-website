"use client";

import { useState } from "react";

interface ShareButtonProps {
  title: string;
  text: string;
  url: string;
}

export function ShareButton({ title, text, url }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function share() {
    setStatus("idle");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2500);
    }
  }

  return (
    <div className="share-control">
      <button className="share-button" type="button" onClick={share}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
        </svg>
        共有
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === "copied" ? "記事URLをコピーしました。" : status === "error" ? "記事URLを共有できませんでした。" : ""}
      </span>
      {status !== "idle" ? <span className={`share-control__notice share-control__notice--${status}`}>{status === "copied" ? "URLをコピーしました" : "共有できませんでした"}</span> : null}
    </div>
  );
}
