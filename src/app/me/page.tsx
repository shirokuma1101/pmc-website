import Link from "next/link";
import { redirect } from "next/navigation";
import { ArticleGrid } from "@/components/article";
import { MarkdownContent } from "@/components/markdown";
import { ProfileForm } from "@/components/profile";
import { MyPageNavigation } from "@/components/profile/MyPageNavigation";
import { PostCard } from "@/components/timeline";
import { EmptyState } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getOwnArticles } from "@/lib/directus/articles";
import { getMyOneTimeSupportCount, getOrganization } from "@/lib/directus/organization";
import { getPosts } from "@/lib/directus/posts";
import { getProfileByUserId } from "@/lib/directus/profiles";
import { getWorldsPage } from "@/lib/directus/worlds";
import { stripeEnabled } from "@/lib/stripe";
import { findSupporterSubscriptionCustomer } from "@/lib/supporter-subscriptions";
import { supporterTierLabel } from "@/lib/organization/supporter";
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

function selectedTab(value: string | string[] | undefined): "profile" | "activity" | "worlds" {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "activity" || tab === "worlds" ? tab : "profile";
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeStyle: "short" });

export const metadata = { title: "マイプロフィール" };

async function canManageMonthlySupport(userId: string): Promise<boolean> {
  if (!stripeEnabled()) return false;
  try {
    return Boolean(await findSupporterSubscriptionCustomer(userId));
  } catch {
    return false;
  }
}

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; status?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/me");
  const query = await searchParams;
  const tab = selectedTab(query.tab);
  const status = selectedStatus(query.status);
  const [storedProfile, articles, posts, canManageSupport, organization, oneTimeSupportCount] = await Promise.all([
    getProfileByUserId(session.user.id, session.accessToken),
    getOwnArticles(session.user.id, session.accessToken, { status, limit: 50 }),
    getPosts({ authorId: session.user.id, accessToken: session.accessToken, limit: 8 }),
    canManageMonthlySupport(session.user.id),
    getOrganization(),
    getMyOneTimeSupportCount(session.accessToken).catch(() => null),
  ]);
  const profile: Profile = storedProfile ?? {
    id: "",
    displayName: session.user.displayName,
    bio: "",
    ...(session.user.avatarUrl ? { avatarUrl: session.user.avatarUrl } : {}),
    user: session.user,
  };
  // Respect the same visibility preference on the private profile preview.
  const supporter = profile.supporterBadgeVisible !== false ? organization.find((item) => item.userId === session.user.id) : undefined;
  const worlds = tab === "worlds" ? await getWorldsPage(session.accessToken) : null;

  return (
    <main id="main-content" className="page-shell my-page-shell">
      <h1 className="sr-only">マイページ</h1>
      <MyPageNavigation canManageSupport={canManageSupport} tab={tab} />
      {tab === "profile" ? (
      <div className="my-page-panel my-page-panel--profile">
        <aside className="profile-settings" aria-labelledby="profile-settings-title">
          <div className="section-heading section-heading--compact">
            <div><p className="eyebrow">Profile</p><h2 id="profile-settings-title">プロフィール編集</h2>{supporter?.supporterTier ? <span className="profile-hero__supporter-badge">{supporterTierLabel(supporter.supporterTier, supporter.supporterBadgeLevel)}</span> : null}</div>
          </div>
          {oneTimeSupportCount !== null ? <p className="one-time-support-summary">単発サポートの累計：{oneTimeSupportCount}回（本人のみ表示）</p> : null}
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
      </div>
      ) : null}
      {tab === "activity" ? (
      <div className="my-page-panel">
        <div className="profile-activity">
          <section aria-labelledby="my-articles-title">
            <div className="section-heading">
              <div><p className="eyebrow">My articles</p><h2 id="my-articles-title">自分の記事</h2></div>
            </div>
            <nav className="status-tabs" aria-label="記事の状態で絞り込む">
              {statusOptions.map((option) => {
                const active = option.value === (status ?? "all");
                const href = option.value === "all" ? "/me?tab=activity" : `/me?tab=activity&status=${option.value}`;
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
      ) : null}
      {tab === "worlds" && worlds ? (
        <div className="my-page-panel worlds-page">
          <header className="section-heading"><div><p className="eyebrow">World Archive</p><h2>過去ワールド</h2></div>{session.user.isAdmin ? <Link className="button button--secondary" href="/admin/worlds">説明文を編集</Link> : null}</header>
          <article className="prose worlds-page__description"><MarkdownContent>{worlds.content.markdown}</MarkdownContent></article>
          <section aria-labelledby="my-world-files-title">
            <header className="section-heading section-heading--compact"><p className="eyebrow">Downloads</p><h2 id="my-world-files-title">ワールドファイル</h2></header>
            {worlds.files.length === 0 ? <EmptyState title="公開中のワールドはありません" description="管理者がファイルを追加すると、ここに表示されます。" /> : (
              <ul className="world-download-list">{worlds.files.map((file) => (
                <li key={file.id} className="world-download-card"><div><h3>{file.filename}</h3>{file.description ? <p>{file.description}</p> : <p className="world-download-card__empty">詳細は登録されていません。</p>}{file.uploadedAt ? <time dateTime={file.uploadedAt}>{dateFormatter.format(new Date(file.uploadedAt))}</time> : null}</div><a className="button button--primary" href={`/api/worlds/${file.id}/download`}>ダウンロード</a></li>
              ))}</ul>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
