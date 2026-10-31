import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/shop/auth-shell";
import { ResetPasswordForm } from "@/components/shop/auth-forms";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

// Reached from the reset email, which logs the person in first.
async function Reset() {
  await requireUser("/reset-password");
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense>
        <Reset />
      </Suspense>
    </AuthShell>
  );
}
