"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart";

export function CartButton() {
  const count = cartCount(useCart());
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper hover:bg-ink-soft"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      <span aria-hidden="true">{count}</span>
    </Link>
  );
}
