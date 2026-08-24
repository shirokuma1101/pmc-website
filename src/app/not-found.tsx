import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="page-shell">
      <section className="error-state" aria-labelledby="not-found-title">
        <p className="eyebrow">404</p>
        <h1 id="not-found-title">ページが見つかりません</h1>
        <p>URLが変わったか、公開されていない記録かもしれません。</p>
        <Link className="button button--primary" href="/">
          トップへ戻る
        </Link>
      </section>
    </main>
  );
}
