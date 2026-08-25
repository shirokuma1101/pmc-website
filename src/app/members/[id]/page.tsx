import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleGrid } from "@/components/article";
import { PostCard } from "@/components/timeline";
import { Avatar, EmptyState } from "@/components/ui";
import { getPublishedArticles } from "@/lib/directus/articles";
import { getPosts } from "@/lib/directus/posts";
import { getProfileByUserId } from "@/lib/directus/profiles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const profile = await getProfileByUserId((await params).id);
  return profile
    ? { title: profile.displayName, description: profile.bio || `${profile.displayName}の活動記録` }
    : { title: "メンバーが見つかりません" };
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [profile, articles, posts] = await Promise.all([
    getProfileByUserId(id),
    getPublishedArticles({ authorId: id, limit: 6 }),
    getPosts({ authorId: id, limit: 8 }),
  ]);
  if (!profile) notFound();
  const member = profile.user ?? { id, displayName: profile.displayName, avatarUrl: profile.avatarUrl };

  return (
    <main id="main-content" className="page-shell">
      <header className="profile-hero">
        <Avatar user={{ ...member, displayName: profile.displayName, avatarUrl: profile.avatarUrl }} size="lg" eager />
        <div>
          <p className="eyebrow">Member</p>
          <h1>{profile.displayName}</h1>
          <p className="profile-hero__bio">{profile.bio || "活動を記録しているPostMineClanメンバーです。"}</p>
          {profile.xboxGamertag ? <p className="profile-hero__gamertag"><span>Xbox</span>{profile.xboxGamertag}</p> : null}
        </div>
      </header>

      <section className="member-section" aria-labelledby="member-articles-title">
        <div className="section-heading"><div><p className="eyebrow">Articles</p><h2 id="member-articles-title">公開記事</h2></div></div>
        <ArticleGrid articles={articles.data} emptyTitle="公開記事はまだありません" emptyDescription="新しい記事が公開されるとここに表示されます。" />
      </section>
      <section className="member-section" aria-labelledby="member-posts-title">
        <div className="section-heading"><div><p className="eyebrow">Posts</p><h2 id="member-posts-title">最近の活動</h2></div></div>
        <div className="timeline-list timeline-list--compact">
          {posts.data.length ? posts.data.map((post) => <PostCard key={post.id} post={post} />) : (
            <EmptyState title="活動記録はまだありません" description="最初のPostを待っています。" symbol="今" />
          )}
        </div>
      </section>
    </main>
  );
}
