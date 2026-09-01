import Link from "next/link";

import styles from "./OrganizationModeSwitch.module.css";

export function OrganizationModeSwitch({ editing }: { editing: boolean }) {
  return (
    <nav className={styles.switcher} aria-label="メンバーページの表示モード">
      <span>管理者モード</span>
      <div>
        <Link href="/organization" aria-current={editing ? undefined : "page"}>
          <span aria-hidden="true">◉</span> 公開表示
        </Link>
        <Link href="/organization?edit=1" aria-current={editing ? "page" : undefined}>
          <span aria-hidden="true">✎</span> 編集する
        </Link>
      </div>
    </nav>
  );
}
