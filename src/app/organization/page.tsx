import { OrganizationEditor } from "@/components/admin/OrganizationEditor";
import { EmptyState } from "@/components/ui";
import { OrganizationDirectory, OrganizationModeSwitch } from "@/components/organization";
import { getSession } from "@/lib/auth/session";
import { getOrganization, getOrganizationAccounts, getOrganizationLayout } from "@/lib/directus/organization";

import styles from "./page.module.css";

export const metadata = { title: "メンバー", description: "PostMineClanのメンバー、所属と役割を紹介します。" };
export const dynamic = "force-dynamic";

export default async function OrganizationPage(props: PageProps<"/organization">) {
  const [members, layout, session, query] = await Promise.all([getOrganization(), getOrganizationLayout(), getSession(), props.searchParams]);
  const canEdit = Boolean(session?.user.isAdmin);
  const editing = canEdit && query.edit === "1";
  const editorData = editing && session
    ? await getOrganizationAccounts(session.accessToken)
    : null;

  return <main id="main-content" className={`page-shell ${editing ? "page-shell--editor" : ""}`}>
    <header className={`page-heading ${canEdit ? styles.editableHeading : ""}`}>
      <div><p className="eyebrow">{editing ? "Member editor" : "Members"}</p><h1>{editing ? "メンバー管理" : "メンバー"}</h1></div>
      {canEdit ? <OrganizationModeSwitch editing={editing} /> : null}
      <p>{editing ? "公開プロフィールと役割・所属を、実際の表示形式に合わせて管理します。" : "PostMineClanで活動するメンバーのプロフィールと、チーム・役割のつながりを紹介します。"}</p>
    </header>
    {editing && editorData
      ? <OrganizationEditor members={members} initialSections={layout} accounts={editorData} />
      : members.length ? <OrganizationDirectory members={members} sections={layout} /> : <EmptyState title="掲載メンバーはまだいません" description="メンバー情報が登録されると、ここに表示されます。" symbol="人" />}
  </main>;
}
