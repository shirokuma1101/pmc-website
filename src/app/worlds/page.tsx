import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkdownContent } from "@/components/markdown";
import { Alert, EmptyState } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getWorldsPage } from "@/lib/directus/worlds";

export const metadata = {
  title: "過去ワールド",
  description: "PostMineClanの過去のMinecraftワールドをダウンロードできます。",
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeStyle: "short" });

export default async function WorldsPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/worlds");
  const [page, query] = await Promise.all([getWorldsPage(session.accessToken), searchParams]);

  return (
    <main id="main-content" className="page-shell worlds-page">
      {query.updated === "true" ? <Alert tone="success">説明文を更新しました。</Alert> : null}
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">World Archive</p>
          <h1>過去ワールド</h1>
        </div>
        {session.user.isAdmin ? <Link className="button button--secondary" href="/admin/worlds">説明文を編集</Link> : null}
      </header>
      <article className="prose worlds-page__description">
        <MarkdownContent>{page.content.markdown}</MarkdownContent>
      </article>
      <section aria-labelledby="world-files-title">
        <header className="section-heading section-heading--compact">
          <p className="eyebrow">Downloads</p>
          <h2 id="world-files-title">ワールドファイル</h2>
        </header>
        {page.files.length === 0 ? (
          <EmptyState title="公開中のワールドはありません" description="管理者がCMSへファイルを追加すると、ここに表示されます。" />
        ) : (
          <ul className="world-download-list">
            {page.files.map((file) => (
              <li key={file.id} className="world-download-card">
                <div>
                  <h3>{file.filename}</h3>
                  {file.description ? <p>{file.description}</p> : <p className="world-download-card__empty">詳細は登録されていません。</p>}
                  {file.uploadedAt ? <time dateTime={file.uploadedAt}>{dateFormatter.format(new Date(file.uploadedAt))}</time> : null}
                </div>
                <a className="button button--primary" href={`/api/worlds/${file.id}/download`}>ダウンロード</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
