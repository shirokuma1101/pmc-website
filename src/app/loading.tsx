export default function Loading() {
  return (
    <main id="main-content" className="page-shell" aria-busy="true" aria-live="polite">
      <div className="loading-state">
        <span className="loading-state__mark" aria-hidden="true" />
        <p>記録を読み込んでいます…</p>
      </div>
    </main>
  );
}
