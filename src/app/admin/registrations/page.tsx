import { notFound, redirect } from "next/navigation";
import { RegistrationApprovalList } from "@/components/admin";
import { EmptyState } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getPendingRegistrations } from "@/lib/directus/registrations";

export const metadata = { title: "アカウント承認" };

export default async function RegistrationsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/registrations");
  if (!session.user.isAdmin) notFound();
  const registrations = await getPendingRegistrations(session.accessToken);
  return <main id="main-content" className="page-shell page-shell--narrow">
    <header className="page-heading"><p className="eyebrow">Account approval</p><h1>新規アカウント申請</h1><p>内容を確認し、サイトの利用を許可するMemberアカウントを承認します。</p></header>
    {registrations.length ? <RegistrationApprovalList registrations={registrations} /> : <EmptyState title="承認待ちの申請はありません" description="新しいアカウント申請が届くとここに表示されます。" symbol="済" />}
  </main>;
}
