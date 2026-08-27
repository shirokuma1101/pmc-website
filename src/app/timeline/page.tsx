import Link from "next/link";
import { PostCard, PostComposer } from "@/components/timeline";
import { EmptyState, Pagination } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getContentAuthors } from "@/lib/directus/authors";
import { getPosts } from "@/lib/directus/posts";

const PAGE_SIZE = 12;

function pageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export const metadata = {
  title: "タイムライン",
  description: "PostMineClanメンバーの活動フィードです",
};

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const page = pageNumber((await searchParams).page);
  const session = await getSession();
  const [result, postAuthors] = await Promise.all([
    getPosts({ page, limit: PAGE_SIZE, accessToken: session?.accessToken }),
    session?.user.isAdmin ? getContentAuthors(session.accessToken) : Promise.resolve([]),
  ]);
  const totalPages = result.pagination.total
    ? Math.max(1, Math.ceil(result.pagination.total / result.pagination.limit))
    : page + (result.pagination.hasMore ? 1 : 0);

  return (
    <main id="main-content" className="page-shell page-shell--narrow">
      <header className="page-heading">
        <p className="eyebrow">Timeline</p>
        <h1>みんなの活動</h1>
        <p>PostMineClanの活動を日々アップデート</p>
      </header>

      {session ? (
        <PostComposer currentUser={session.user} isAdmin={session.user.isAdmin} authorOptions={postAuthors} />
      ) : (
        <aside className="signin-prompt">
          <div>
            <strong>あなたの活動も残しませんか？</strong>
            <p>ログインすると、このページからすぐに投稿できます。</p>
          </div>
          <Link className="button button--primary button--sm" href="/login?next=/timeline">ログイン</Link>
        </aside>
      )}

      <section className="timeline-list" aria-label="活動記録">
        {result.data.length ? result.data.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={session?.user.id}
            canManage={session?.user.isAdmin ? true : undefined}
            adminMode={session?.user.isAdmin}
            authorOptions={postAuthors}
          />
        )) : (
          <EmptyState title="投稿はまだありません" description="最初の活動記録を投稿してみましょう。" symbol="今" />
        )}
      </section>
      <Pagination currentPage={page} totalPages={totalPages} basePath="/timeline" />
    </main>
  );
}
