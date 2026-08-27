import { notFound, redirect } from "next/navigation";
import { WorldsEditorForm } from "@/components/admin/WorldsEditorForm";
import { getSession } from "@/lib/auth/session";
import { getWorldsPage } from "@/lib/directus/worlds";

export const metadata = { title: "過去ワールド説明文編集" };

export default async function AdminWorldsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/worlds");
  if (!session.user.isAdmin) notFound();
  const page = await getWorldsPage(session.accessToken);
  return (
    <main id="main-content" className="page-shell page-shell--editor">
      <header className="page-heading">
        <p className="eyebrow">World Archive editor</p>
        <h1>過去ワールドの説明文を編集</h1>
        <p>ファイルの追加・変更・削除はDirectusの専用フォルダーで行います。</p>
      </header>
      <WorldsEditorForm initialContent={page.content} />
    </main>
  );
}
