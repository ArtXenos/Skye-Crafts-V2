import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/shop/auth-shell";
import { LoginForm } from "@/components/shop/auth-forms";
import { Notice } from "@/components/ui/form";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

const NOTICES: Record<string, string> = {
  "link-expired": "That link has expired or was already used. Log in, or ask for a new link.",
};

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, notice } = await searchParams;
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;
  return (
    <>
      {message && <Notice className="mb-5">{message}</Notice>}
      <LoginForm next={safeNextPath(next)} />
    </>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <AuthShell title="Welcome back" intro="Log in to check out and follow your orders.">
      <Suspense>
        <Login searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
