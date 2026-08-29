"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import type { UserSummary } from "@/types";

import { Alert } from "../ui/Alert";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { classNames } from "../ui/classNames";
import { AdminNotificationTray } from "./AdminNotificationTray";
import { useCloseDetailsOnOutsideClick } from "./useCloseDetailsOnOutsideClick";

export interface SiteHeaderProps {
  currentUser?: UserSummary | null;
  isAdmin?: boolean;
  brandName?: string;
}

const publicNavigation = [
  { href: "/timeline", label: "タイムライン" },
  { href: "/articles", label: "記事" },
  { href: "/map", label: "マップ" },
  { href: "/about", label: "About Us" },
];

const memberNavigation = [
  { href: "/worlds", label: "過去ワールド" },
];

export function SiteHeader({
  currentUser = null,
  isAdmin = false,
  brandName = "PostMineClan",
}: SiteHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const adminNavigationRef = useRef<HTMLDetailsElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useCloseDetailsOnOutsideClick(adminNavigationRef);

  useLayoutEffect(() => {
    const storedTheme = localStorage.getItem("pmc-theme");
    const theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("pmc-theme", nextTheme);
  }

  async function handleLogout() {
    setLoggingOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("ログアウトに失敗しました。");
      setMenuOpen(false);
      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ログアウトに失敗しました。");
    } finally {
      setLoggingOut(false);
    }
  }

  function isCurrent(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link
            className="site-brand"
            href="/"
            aria-label={`${brandName} トップページ`}
            onClick={() => setMenuOpen(false)}
          >
            <Image
              className="site-brand__logo"
              src="/pmc-logo.svg"
              alt=""
              width={1600}
              height={1600}
              priority
            />
            <span>
              <span className="site-brand__name">{brandName}</span>
              <span className="site-brand__tagline">好きなものが創れる世界</span>
            </span>
          </Link>

          <nav
            className={classNames("site-navigation", menuOpen && "site-navigation--open")}
            id="site-navigation"
            aria-label="メインナビゲーション"
          >
            <div className="site-navigation__links">
              {[...publicNavigation, ...(currentUser ? memberNavigation : [])].map((item) => (
                <Link
                  key={item.href}
                  className={classNames(
                    "site-navigation__link",
                    isCurrent(item.href) && "site-navigation__link--current",
                  )}
                  href={item.href}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="site-navigation__account">
              {currentUser ? (
                <>
                  <Link className="button button--secondary button--sm" href="/article/new" onClick={() => setMenuOpen(false)}>
                    記事を書く
                  </Link>
                  {isAdmin ? (
                    <>
                      <div className="site-header__desktop-notifications">
                        <AdminNotificationTray onNavigate={() => setMenuOpen(false)} />
                      </div>
                      <details ref={adminNavigationRef} className="admin-navigation">
                        <summary>管理</summary>
                        <div className="admin-navigation__menu">
                          <Link href="/admin/reviews" onClick={() => setMenuOpen(false)}>レビュー</Link>
                          <Link href="/admin/registrations" onClick={() => setMenuOpen(false)}>アカウント承認</Link>
                          <Link href="/admin/worlds" onClick={() => setMenuOpen(false)}>過去ワールド説明文</Link>
                        </div>
                      </details>
                    </>
                  ) : null}
                  <Link className="account-link" href="/me" onClick={() => setMenuOpen(false)}>
                    <Avatar user={currentUser} size="sm" />
                    <span className="account-link__name">{currentUser.displayName}</span>
                  </Link>
                  <Button variant="ghost" size="sm" loading={loggingOut} onClick={handleLogout}>
                    ログアウト
                  </Button>
                </>
              ) : (
                <Link className="button button--primary button--sm" href="/login" onClick={() => setMenuOpen(false)}>
                  ログイン
                </Link>
              )}
            </div>
          </nav>

          <div className="site-header__controls">
            {currentUser && isAdmin ? (
              <div className="site-header__mobile-notifications">
                <AdminNotificationTray onNavigate={() => setMenuOpen(false)} />
              </div>
            ) : null}
            <button
              className="theme-toggle"
              type="button"
              aria-label="ライトモードとダークモードを切り替える"
              title="表示テーマを切り替える"
              onClick={toggleTheme}
            >
              <svg className="theme-toggle__moon" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M20.4 15.3A8.7 8.7 0 0 1 8.7 3.6 8.8 8.8 0 1 0 20.4 15.3Z" />
              </svg>
              <svg className="theme-toggle__sun" aria-hidden="true" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3.6" />
                <path d="M12 2.2v2.1M12 19.7v2.1M2.2 12h2.1M19.7 12h2.1M5.1 5.1l1.5 1.5M17.4 17.4l1.5 1.5M18.9 5.1l-1.5 1.5M6.6 17.4l-1.5 1.5" />
              </svg>
            </button>

            <button
              className="site-header__menu-button"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="site-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">{menuOpen ? "×" : "≡"}</span>
              <span className="sr-only">メニューを{menuOpen ? "閉じる" : "開く"}</span>
            </button>
          </div>
        </div>
        {error ? (
          <div className="site-header__notice">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
      </header>
    </>
  );
}
