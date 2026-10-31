import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav, AdminNavLinks } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Shop admin", template: "%s | Shop admin" },
  robots: { index: false, follow: false },
};

/** Nothing below renders (or loads data) until the visitor is confirmed as an admin. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b-2 border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-baseline gap-3">
              <Link href="/" className="font-display text-2xl">Skye Crafts</Link>
              <span className="text-sm font-semibold text-ink-soft">Shop admin</span>
            </p>
            <Link href="/" className="text-sm font-semibold underline decoration-bloom-deep underline-offset-4">View the shop</Link>
          </div>
          <Suspense fallback={<AdminNavLinks />}>
            <AdminNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
