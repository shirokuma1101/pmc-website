import Link from "next/link";
import { MarkdownContent } from "@/components/markdown";
import { Alert } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getAboutContent } from "@/lib/directus/about";

export const metadata = {
  title: "About Us",
  description: "PostMineClanについてご紹介します。",
};

const history = [
  { dateTime: "2019-10-14", date: "2019.10.14", event: "PostMineClan設立（当時10人ほど）" },
  { dateTime: "2019-10-20", date: "2019.10.20", event: "PMC 1.0 開始" },
  { dateTime: "2019-12-07", date: "2019.12.7", event: "コンビナート危機" },
  { dateTime: "2020-03-03", date: "2020.3.3", event: "ひな祭り建築コンテスト" },
  { dateTime: "2020-04-11", date: "2020.4.11", event: "OlymPMC" },
  { dateTime: "2020-10-14", date: "2020.10.14", event: "PostMineClan一周年＆建築見分けコンテスト" },
  { dateTime: "2021-03-21", date: "2021.3.21", event: "PMC 2.0へ移行" },
  { dateTime: "2021-12-01", date: "2021.12.1", event: "PMC 3.0へ移行" },
  { dateTime: "2022-08-15", date: "2022.8.15", event: "PMC 4.0へ移行" },
  { dateTime: "2023-01-27", date: "2023.1.27", event: "PMC 5.0へ移行" },
  { dateTime: "2024", date: "2024–2025", event: "休止" },
  { dateTime: "2026-06-26", date: "2026.6.26", event: "PMC 6.0開始（活動再開）" },
] as const;

export default async function AboutPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const [session, content, query] = await Promise.all([getSession(), getAboutContent(), searchParams]);
  return (
    <main id="main-content" className="page-shell about-page">
      {query.updated === "true" ? <Alert tone="success">About Usを更新しました。</Alert> : null}
      <header className="page-heading about-page__heading">
        <p className="eyebrow">About Us</p>
        <h1>PostMineClanについて</h1>
        {session?.user.isAdmin ? <Link className="button button--secondary" href="/admin/about">内容を編集</Link> : null}
      </header>
      <article className="prose about-markdown">
        <MarkdownContent>{content.markdown}</MarkdownContent>
      </article>
      <section className="about-history" aria-labelledby="about-history-title">
        <header className="about-section-heading">
          <p className="eyebrow">Our History</p>
          <h2 id="about-history-title">歴史</h2>
        </header>
        <ol className="about-history__timeline">
          {history.map((item) => (
            <li key={`${item.date}-${item.event}`}>
              <span className="about-history__marker" aria-hidden="true" />
              <time dateTime={item.dateTime}>{item.date}</time>
              <p>{item.event}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="about-cta" aria-labelledby="about-join-title">
        <div>
          <p className="eyebrow">Join Us</p>
          <h2 id="about-join-title">
            <span>PostMineClanに</span><span>参加する</span>
          </h2>
        </div>
        <div className="about-cta__actions">
          <a
            className="button button--primary"
            href="https://forms.gle/nAfeagxWa9JFMWHw5"
            target="_blank"
            rel="noopener noreferrer"
          >
            参加フォームを開く
          </a>
        </div>
      </section>
    </main>
  );
}
