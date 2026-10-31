"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/requests", label: "Custom requests" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/settings", label: "Settings" },
];

/** The admin links, highlighting the current section. */
export function AdminNav() {
  return <AdminNavLinks pathname={usePathname()} />;
}

/** Without a pathname (while the page streams in), nothing is highlighted. */
export function AdminNavLinks({ pathname = "" }: { pathname?: string }) {
  return (
    <nav aria-label="Admin" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/orders") : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold", active ? "bg-ink text-paper" : "hover:bg-petal")}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
