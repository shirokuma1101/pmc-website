import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getOrganization } from "@/lib/directus/organization";
import type { SupporterTier } from "@/types";
import styles from "./page.module.css";

export const metadata = { title: "サポーター運用" };
export const dynamic = "force-dynamic";

const MONTHLY_ROLES: Partial<Record<SupporterTier, string>> = {
  basic: "Basic Supporter",
  standard: "Standard Supporter",
  premium: "Premium Supporter",
};

export default async function AdminSupportersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/supporters");
  if (!session.user.isAdmin) notFound();

  const members = (await getOrganization(session.accessToken))
    .filter((member) => member.supporterTier && MONTHLY_ROLES[member.supporterTier])
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "ja"));
  const counts = {
    basic: members.filter((member) => member.supporterTier === "basic").length,
    standard: members.filter((member) => member.supporterTier === "standard").length,
    premium: members.filter((member) => member.supporterTier === "premium").length,
  };

  return (
    <main id="main-content" className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">Supporter operations</p>
        <h1>サポーター運用</h1>
        <p>サイト上で有効な月額プランを正として、Discordの装飾ロールを手動で管理します。</p>
      </header>

      <section className={styles.summary} aria-label="プラン別契約者数">
        <article><span>Basic Supporter</span><strong>{counts.basic}人</strong></article>
        <article><span>Standard Supporter</span><strong>{counts.standard}人</strong></article>
        <article><span>Premium Supporter</span><strong>{counts.premium}人</strong></article>
      </section>

      <div className={styles.layout}>
        <section className={styles.roster} aria-labelledby="supporter-roster-title">
          <h2 id="supporter-roster-title">Discordロール設定対象</h2>
          <small>この一覧は現在有効なサイト上のサポーターバッジから生成されています。</small>
          {members.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>メンバー</th><th>サイト上のプラン</th><th>設定するDiscordロール</th></tr></thead>
                <tbody>{members.map((member) => (
                  <tr key={member.profileId}>
                    <td>{member.displayName}</td>
                    <td>{MONTHLY_ROLES[member.supporterTier!]}</td>
                    <td><span className={styles.role}>{MONTHLY_ROLES[member.supporterTier!]}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className={styles.empty}>現在、Discordロールの設定対象者はいません。</p>}
        </section>

        <aside className={styles.guide} aria-labelledby="supporter-guide-title">
          <h2 id="supporter-guide-title">管理時の確認項目</h2>
          <ol>
            <li>DiscordにBasic・Standard・Premiumの3つの装飾ロールを用意する</li>
            <li>各ロールに管理権限や発言上の優先権を付与しない</li>
            <li>一覧のプランと異なるロールが付いている場合は変更する</li>
            <li>以前の対象者が一覧から消えた場合はDiscordロールを解除する</li>
            <li>契約更新・変更・解約後にこのページを再確認する</li>
          </ol>
          <p className={styles.note}>Discordのユーザー名はサイトと異なる場合があります。本人確認は、登録済みの連絡手段を使って行ってください。</p>
        </aside>
      </div>
    </main>
  );
}
