import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { CartButton } from "./cart-button";

const NAV = [
  { href: "/products", label: "Shop" },
  { href: "/#custom", label: "Custom orders" },
  { href: "/#help", label: "Ordering help" },
];

async function AccountLinks() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-petal">
        Log in
      </Link>
    );
  }
  return (
    <>
      {user.isAdmin && (
        <Link href="/admin" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-petal">
          Shop admin
        </Link>
      )}
      <Link href="/account" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-petal">
        My orders
      </Link>
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b-2 border-line/70 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80 sm:sticky sm:top-0 sm:z-30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-2xl leading-none text-ink">
          Skye Crafts
        </Link>
        <nav aria-label="Main" className="order-3 -mx-2 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="shrink-0 rounded-full px-3 py-2 text-sm font-medium hover:bg-petal">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Suspense fallback={<span className="w-20" />}>
            <AccountLinks />
          </Suspense>
          <CartButton />
        </div>
      </div>
    </header>
  );
}
