"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="page-shell">
      <section className="error-state" aria-labelledby="error-title">
        <p className="eyebrow">Something went wrong</p>
        <h1 id="error-title">うまく読み込めませんでした</h1>
        <p>通信状況を確認して、もう一度お試しください。</p>
        <Button onClick={reset}>もう一度試す</Button>
      </section>
    </main>
  );
}
