import { PasswordResetRequestForm } from "@/components/auth";

export const metadata = { title: "パスワード再設定" };

export default function ForgotPasswordPage() {
  return (
    <main id="main-content" className="auth-page">
      <div className="auth-page__backdrop" aria-hidden="true" />
      <PasswordResetRequestForm />
    </main>
  );
}
