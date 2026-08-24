import { notFound, redirect } from "next/navigation";
import { RegistrationForm } from "@/components/auth";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "アカウント作成" };

export default async function RegisterPage() {
  if (process.env.REGISTRATION_ENABLED !== "true") notFound();
  if (await getSession()) redirect("/timeline");
  return (
    <main id="main-content" className="auth-page">
      <div className="auth-page__backdrop" aria-hidden="true" />
      <RegistrationForm />
    </main>
  );
}
