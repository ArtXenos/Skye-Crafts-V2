"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Product } from "@/lib/data/catalog";
import { CATEGORIES } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { Checkbox, Input } from "@/components/ui/form";

/**
 * Search and filter the (small) catalogue in the browser, instantly. The
 * cards are rendered on the server and passed in, so this component only
 * decides which ones to show.
 */
export function Catalogue({ items }: { items: { product: Product; card: ReactNode }[] }) {
  const products = items.map((item) => item.product);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  const categories = CATEGORIES.filter((name) => products.some((product) => product.category === name));
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      ({ product }) =>
        (!category || product.category === category) &&
        (!availableOnly || product.is_preorder || product.stock > 0) &&
        (!term || `${product.title} ${product.description} ${product.category}`.toLowerCase().includes(term)),
    );
  }, [items, category, search, availableOnly]);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
          {["", ...categories].map((name) => (
            <button key={name || "all"} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}
              className={cn(
                "rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors",
                category === name ? "border-ink bg-ink text-paper" : "border-line hover:border-bloom",
              )}>
              {name || "Everything"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Input type="search" aria-label="Search pieces" placeholder="Search, e.g. rose" value={search}
            onChange={(event) => setSearch(event.target.value)} className="w-56" />
          <Checkbox label="Hide sold out" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{visible.length} pieces shown</p>
      {visible.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {visible.map(({ product, card }) => (
            <div key={product.id}>{card}</div>
          ))}
        </div>
      ) : (
        <p className="rounded-[var(--radius-tile)] bg-petal px-6 py-10 text-center">
          Nothing matches yet. Clear the search, or{" "}
          <Link href="/#custom" className="font-semibold underline decoration-bloom-deep underline-offset-4">request a custom piece</Link>.
        </p>
      )}
    </div>
  );
}
