import { notFound, redirect } from "next/navigation";
import { ArticleForm } from "@/components/article";
import { getSession } from "@/lib/auth/session";
import { getArticleById, getArticleReviews } from "@/lib/directus/articles";

export const metadata = { title: "記事を編集" };

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/article/${id}/edit`)}`);

  const article = await getArticleById(id, session.accessToken);
  if (!article || (!session.user.isAdmin && article.author.id !== session.user.id)) notFound();

  const reviews = await getArticleReviews(id, session.accessToken).catch(() => []);
  const lastRejection = reviews.toReversed().find((review) => review.action === "rejected" && review.comment);
  const articleWithFeedback = lastRejection?.comment
    ? { ...article, reviewComment: lastRejection.comment }
    : article;

  return (
    <main id="main-content" className="page-shell page-shell--editor">
      <ArticleForm
        article={articleWithFeedback}
        allowPublishedEdit
        adminMode={session.user.isAdmin}
        cancelHref={article.status === "published" ? `/articles/${article.slug}` : "/me"}
      />
    </main>
  );
}
