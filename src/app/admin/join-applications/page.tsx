import { notFound, redirect } from "next/navigation";
import { JoinApplicationReviewList } from "@/components/admin";
import { EmptyState } from "@/components/ui";
import { getSession } from "@/lib/auth/session";
import { getJoinApplications } from "@/lib/directus/join-applications";

export const metadata = { title: "参加申請管理" };

export default async function JoinApplicationsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin/join-applications");
  if (!session.user.isAdmin) notFound();
  const applications = await getJoinApplications(session.accessToken);
  return <main id="main-content" className="page-shell page-shell--narrow">
    <header className="page-heading">
      <p className="eyebrow">Join applications</p>
      <h1>参加申請管理</h1>
      <p>参加フォームから届いた内容を確認し、承認または拒否の結果を申請者へメールで通知します。</p>
    </header>
    {applications.length
      ? <JoinApplicationReviewList applications={applications} />
      : <EmptyState title="参加申請はありません" description="参加フォームから申請が届くとここに表示されます。" symbol="済" />}
  </main>;
}
