import { notFound, redirect } from "next/navigation";
import { AboutEditorForm } from "@/components/admin/AboutEditorForm";
import { getSession } from "@/lib/auth/session";
import { getAboutContent } from "@/lib/directus/about";

export const metadata = { title: "About Us編集" };

export default async function AdminAboutPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/about");
  if (!session.user.isAdmin) notFound();
  const content = await getAboutContent(session.accessToken);

  return (
    <main id="main-content" className="page-shell page-shell--editor">
      <header className="page-heading">
        <p className="eyebrow">About Us editor</p>
        <h1>About Usを編集</h1>
        <p>公開ページに表示する内容をMarkdownで自由に編集します。</p>
      </header>
      <AboutEditorForm initialContent={content} />
    </main>
  );
}
