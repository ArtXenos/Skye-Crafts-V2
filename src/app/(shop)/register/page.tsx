import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/shop/auth-shell";
import { RegisterForm } from "@/components/shop/auth-forms";
import { safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

async function Register({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { next } = await searchParams;
  return <RegisterForm next={safeNextPath(next)} />;
}

export default function RegisterPage(props: PageProps<"/register">) {
  return (
    <AuthShell title="Create an account" intro="You'll need one to place orders and follow them. Browsing and your cart work without it.">
      <Suspense>
        <Register searchParams={props.searchParams} />
      </Suspense>
    </AuthShell>
  );
}
