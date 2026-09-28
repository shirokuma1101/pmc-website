import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { contactRecipientOptions } from "@/lib/contact/recipients";

export const metadata: Metadata = { title: "お問い合わせ", description: "PostMineClanへのお問い合わせ窓口" };
export const dynamic = "force-dynamic";

export default function ContactPage() {
  return <main id="main-content" className="page-shell page-shell--narrow join-page"><header className="page-heading"><p className="eyebrow">Contact PostMineClan</p><h1>お問い合わせ</h1><p>サポーター・決済、アカウント、コミュニティなどのご相談を受け付けています。</p></header><ContactForm recipients={contactRecipientOptions()} /></main>;
}
