import type { Metadata } from "next";
import { AuthShell } from "@/components/shop/auth-shell";
import { ForgotPasswordForm } from "@/components/shop/auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" intro="Enter your account's email and we'll send you a link to choose a new password.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
