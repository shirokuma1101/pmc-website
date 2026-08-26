import Link from "next/link";
import { CookieSettingsButton } from "@/components/privacy";

export interface SiteFooterProps {
  brandName?: string;
}

function XIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4.2 3.5h4.2l4.7 6.3 5.4-6.3h1.4l-6.1 7.2 6.3 8.5h-4.2l-5-6.7-5.7 6.7H3.8l6.4-7.6-6-8.1Zm3.5 1.2 8.8 13.4h1.9L9.6 4.7H7.7Z" /></svg>;
}

function GitHubIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2.8a9.4 9.4 0 0 0-3 18.3c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.7.1-.7.1-.7 1 0 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 2.9.8.1-.7.4-1.1.7-1.3-2.3-.3-4.7-1.1-4.7-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.4-1.3.1-2.7 0 0 .9-.3 2.8 1.1a9.7 9.7 0 0 1 5.1 0c2-1.4 2.8-1.1 2.8-1.1.6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.7 5 .4.3.7 1 .7 1.9v2.7c0 .3.2.6.7.5A9.4 9.4 0 0 0 12 2.8Z" /></svg>;
}

export function SiteFooter({ brandName = "PostMineClan" }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__brand">{brandName}</p>
          <p className="site-footer__copy">好きなものが創れるMinecraftコミュニティ</p>
          <div className="site-footer__socials" aria-label="ソーシャルリンク">
            <a href="https://x.com/PostMineClan" target="_blank" rel="noreferrer" aria-label="PostMineClanのXを開く" title="X">
              <XIcon />
            </a>
            <a href="https://github.com/shirokuma1101/pmc-website" target="_blank" rel="noreferrer" aria-label="pmc-websiteのGitHubリポジトリを開く" title="GitHub">
              <GitHubIcon />
            </a>
          </div>
        </div>
        <nav className="site-footer__links" aria-label="フッターナビゲーション">
          <Link href="/timeline">タイムライン</Link>
          <Link href="/articles">記事</Link>
          <Link href="/about">About Us</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/terms">利用規約</Link>
          <CookieSettingsButton />
        </nav>
        <p className="site-footer__copyright">
          <span aria-hidden="true">©</span> {new Date().getFullYear()} {brandName}
        </p>
      </div>
    </footer>
  );
}
