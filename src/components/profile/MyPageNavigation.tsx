"use client";

import Link from "next/link";
import { useState } from "react";

export function MyPageNavigation({ tab, canManageSupport }: { tab: "profile" | "activity" | "worlds"; canManageSupport: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="my-page-navigation">
      <button aria-controls="my-page-tabs" aria-expanded={open} className="my-page-navigation__toggle" onClick={() => setOpen(!open)} type="button">
        <span aria-hidden="true" className="my-page-navigation__icon"><span /><span /><span /></span>
        マイページのメニュー
      </button>
      <nav aria-label="マイページの項目" className="my-page-tabs" data-open={open} id="my-page-tabs">
        {([
          { id: "profile", label: "プロフィール" },
          { id: "activity", label: "記事・Postの状態" },
          { id: "worlds", label: "ワールドダウンロード" },
        ] as const).map((item) => (
          <Link aria-current={tab === item.id ? "page" : undefined} href={item.id === "profile" ? "/me" : `/me?tab=${item.id}`} key={item.id}>{item.label}</Link>
        ))}
        {canManageSupport ? <form action="/api/supporters/portal" className="my-page-tabs__management" method="post">
          <button type="submit">支払い方法・月額契約を管理 <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="M13 5h6v6M19 5l-9 9M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg></button>
        </form> : null}
      </nav>
    </div>
  );
}
