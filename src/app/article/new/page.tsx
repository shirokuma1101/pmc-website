import { redirect } from "next/navigation";
import { ArticleForm } from "@/components/article";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "新しい記事を書く" };

export default async function NewArticlePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/article/new");

  return (
    <main id="main-content" className="page-shell page-shell--editor">
      <ArticleForm />
    </main>
  );
}
