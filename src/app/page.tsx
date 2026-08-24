import Image from "next/image";
import Link from "next/link";
import { ArticleGrid } from "@/components/article/ArticleGrid";
import { ArticleImageSlider } from "@/components/article/ArticleImageSlider";
import { PostCard } from "@/components/timeline";
import { EmptyState } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getPublishedArticles } from "@/lib/directus/articles";
import { getPosts } from "@/lib/directus/posts";
import styles from "./page.module.css";

function XPlaceholderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4.2 3.5h4.2l4.7 6.3 5.4-6.3h1.4l-6.1 7.2 6.3 8.5h-4.2l-5-6.7-5.7 6.7H3.8l6.4-7.6-6-8.1Zm3.5 1.2 8.8 13.4h1.9L9.6 4.7H7.7Z" />
    </svg>
  );
}

function GitHubPlaceholderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 2.8a9.4 9.4 0 0 0-3 18.3c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.7.1-.7.1-.7 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 2.9.8.1-.7.4-1.1.7-1.3-2.3-.3-4.7-1.1-4.7-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1.1a9.7 9.7 0 0 1 5.1 0c2-1.4 2.8-1.1 2.8-1.1.6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.7 5 .4.3.7 1 .7 1.9v2.7c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.8Z" />
    </svg>
  );
}

export default async function HomePage() {
  const session = await getSession();
  const [posts, articles] = await Promise.all([
    getPosts({ limit: 3, accessToken: session?.accessToken }),
    getPublishedArticles({ limit: 10, accessToken: session?.accessToken }),
  ]);

  return (
    <main id="main-content">
      <section className={styles.hero} aria-labelledby="home-title">
        <ArticleImageSlider articles={articles.data} />
        <div className={styles.heroContent}>
          <Image
            className={styles.logo}
            src="/pmc-logo.svg"
            alt="PostMineClan PMCロゴ"
            width={1600}
            height={1600}
            priority
          />

          <div className={styles.copy}>
            <h1 id="home-title">PostMineClan</h1>
            <p>好きなものが創れる世界</p>
          </div>

          <div className={styles.socials} aria-label="ソーシャルリンク">
            <a
              className={styles.socialIcon}
              href="https://x.com/PostMineClan"
              target="_blank"
              rel="noreferrer"
              aria-label="PostMineClanのXを開く"
              title="X"
            >
              <XPlaceholderIcon />
            </a>
            <a
              className={styles.socialIcon}
              href="https://github.com/shirokuma1101/pmc-website"
              target="_blank"
              rel="noreferrer"
              aria-label="pmc-websiteのGitHubリポジトリを開く"
              title="GitHub"
            >
              <GitHubPlaceholderIcon />
            </a>
          </div>
        </div>
      </section>

      <section className="home-section home-section--timeline" aria-labelledby="latest-posts-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Latest activity</p>
            <h2 id="latest-posts-title">いまの活動</h2>
          </div>
          <Link className="text-link" href="/timeline">すべて見る <span aria-hidden="true">→</span></Link>
        </div>
        <div className="home-timeline">
          {posts.data.length ? posts.data.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={session?.user.id} />
          )) : (
            <EmptyState title="最初の活動を待っています" description="ログインすると、日々の小さな進捗を投稿できます。" symbol="記" />
          )}
        </div>
      </section>

      <section className="home-section" aria-labelledby="latest-articles-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fresh stories</p>
            <h2 id="latest-articles-title">新着記事</h2>
          </div>
          <Link className="text-link" href="/articles">すべて見る <span aria-hidden="true">→</span></Link>
        </div>
        <ArticleGrid articles={articles.data.slice(0, 3)} />
      </section>

      <Link className={styles.joinButton} href="/about">
        <span>参加申請はこちらから</span>
        <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}
