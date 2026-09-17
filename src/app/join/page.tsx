import type { Metadata } from "next";
import { JoinApplicationForm } from "@/components/join/JoinApplicationForm";

export const metadata: Metadata = {
  title: "参加申請",
  description: "PostMineClanへの参加申請内容を入力・確認できます。",
};

export default function JoinPage() {
  return (
    <main id="main-content" className="page-shell page-shell--narrow join-page">
      <header className="page-heading">
        <p className="eyebrow">Join Us</p>
        <h1>PostMineClanに参加する</h1>
        <p>
          参加条件と規約をご確認のうえ、申請内容を入力してください。現在はフォーム内容の確認のみ利用できます。
        </p>
      </header>
      <JoinApplicationForm />
    </main>
  );
}
