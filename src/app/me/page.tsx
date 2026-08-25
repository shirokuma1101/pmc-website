import Link from "next/link";
import { redirect } from "next/navigation";
import { ArticleGrid } from "@/components/article";
import { ProfileForm } from "@/components/profile";
import { PostCard } from "@/components/timeline";
import { Avatar, EmptyState } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getOwnArticles } from "@/lib/directus/articles";
import { getPosts } from "@/lib/directus/posts";
import { getProfileByUserId } from "@/lib/directus/profiles";
import type { ArticleStatus, Profile } from "@/types";

const statusOptions: Array<{ value: ArticleStatus | "all"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "draft", label: "下書き" },
  { value: "pending", label: "レビュー中" },
  { value: "published", label: "公開済み" },
  { value: "rejected", label: "差し戻し" },
];

function selectedStatus(value: string | string[] | undefined): ArticleStatus | undefined {
  const status = Array.isArray(value) ? value[0] : value;
  return status === "draft" || status === "pending" || status === "published" || status === "rejected"
    ? status
    : undefined;
}

export const metadata = { title: "マイプロフィール" };

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/me");
  const status = selectedStatus((await searchParams).status);
  const [storedProfile, articles, posts] = await Promise.all([
    getProfileByUserId(session.user.id, session.accessToken),
    getOwnArticles(session.user.id, session.accessToken, { status, limit: 50 }),
    getPosts({ authorId: session.user.id, accessToken: session.accessToken, limit: 8 }),
  ]);
  const profile: Profile = storedProfile ?? {
    id: "",
    displayName: session.user.displayName,
    bio: "",
    ...(session.user.avatarUrl ? { avatarUrl: session.user.avatarUrl } : {}),
    user: session.user,
  };

  return (
    <main id="main-content" className="page-shell">
      <header className="profile-hero profile-hero--mine">
        <Avatar user={{ ...session.user, displayName: profile.displayName, avatarUrl: profile.avatarUrl }} size="lg" eager />
        <div>
          <p className="eyebrow">My PostMineClan</p>
          <h1>{profile.displayName}</h1>
          <p className="profile-hero__bio">{profile.bio || "プロフィールを整えて、活動について紹介しましょう。"}</p>
          {profile.xboxGamertag ? <p className="profile-hero__gamertag"><span>Xbox</span>{profile.xboxGamertag}</p> : null}
        </div>
        <Link className="button button--primary" href="/article/new">新しい記事を書く</Link>
      </header>

      <div className="profile-layout">
        <aside className="profile-settings" aria-labelledby="profile-settings-title">
          <div className="section-heading section-heading--compact">
            <div><p className="eyebrow">Profile</p><h2 id="profile-settings-title">プロフィール編集</h2></div>
          </div>
          <ProfileForm profile={profile} />
          <Link className="profile-security-link" href="/settings/security">
            <span className="profile-security-link__copy">
              <strong>2段階認証</strong>
              <small>アカウントのセキュリティ設定</small>
            </span>
            <span className={`security-status security-status--${session.user.tfaEnabled ? "enabled" : "disabled"}`}>
              {session.user.tfaEnabled ? "有効" : "未設定"}
            </span>
          </Link>
        </aside>

        <div className="profile-activity">
          <section aria-labelledby="my-articles-title">
            <div className="section-heading">
              <div><p className="eyebrow">My articles</p><h2 id="my-articles-title">自分の記事</h2></div>
              <Link className="text-link" href="/article/new">新規作成 <span aria-hidden="true">＋</span></Link>
            </div>
            <nav className="status-tabs" aria-label="記事の状態で絞り込む">
              {statusOptions.map((option) => {
                const active = option.value === (status ?? "all");
                const href = option.value === "all" ? "/me" : `/me?status=${option.value}`;
                return <Link key={option.value} href={href} aria-current={active ? "page" : undefined}>{option.label}</Link>;
              })}
            </nav>
            <ArticleGrid
              articles={articles.data}
              showStatus
              showEditLinks
              emptyTitle="該当する記事はありません"
              emptyDescription="記事を書いたり、別の状態を選んだりしてみましょう。"
            />
          </section>

          <section aria-labelledby="my-posts-title">
            <div className="section-heading">
              <div><p className="eyebrow">My posts</p><h2 id="my-posts-title">自分のPost</h2></div>
              <Link className="text-link" href="/timeline">投稿する <span aria-hidden="true">→</span></Link>
            </div>
            <div className="timeline-list timeline-list--compact">
              {posts.data.length ? posts.data.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={session.user.id} />
              )) : <EmptyState title="Postはまだありません" description="タイムラインから今日の活動を残せます。" symbol="今" />}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
