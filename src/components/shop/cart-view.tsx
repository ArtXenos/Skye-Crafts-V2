"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductArt } from "@/components/shop/art";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { cart, useCart, type CartLine } from "@/lib/cart";
import type { Product } from "@/lib/data/catalog";
import { formatPeso } from "@/lib/money";
import { MAX_QUANTITY } from "@/lib/shop";

export function maxFor(product: Product) {
  return Math.min(product.is_preorder ? MAX_QUANTITY : product.stock, MAX_QUANTITY);
}

/** Cart lines joined with current products, dropping what can't be bought. */
export function useCartItems(products: Product[]) {
  const lines = useCart();
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const [notice, setNotice] = useState("");

  const cleaned = useMemo(() => {
    const result: CartLine[] = [];
    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product || maxFor(product) <= 0) continue;
      result.push({ productId: line.productId, quantity: Math.min(line.quantity, maxFor(product)) });
    }
    return result;
  }, [lines, byId]);

  // If anything sold out or was removed since it was added, fix the saved
  // cart and say so, rather than failing later at checkout.
  const changed = JSON.stringify(cleaned) !== JSON.stringify(lines);
  if (changed && !notice) setNotice("Your cart was updated: some pieces sold out or have fewer left.");
  useEffect(() => {
    if (changed) cart.replace(cleaned);
  }, [changed, cleaned]);

  const items = cleaned.map((line) => ({ ...line, product: byId.get(line.productId)! }));
  const subtotal = items.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0);
  return { items, subtotal, notice };
}

export function CartView({ products }: { products: Product[] }) {
  const { items, subtotal, notice } = useCartItems(products);

  if (items.length === 0) {
    return (
      <div className="grid justify-items-start gap-4 rounded-[var(--radius-tile)] bg-petal p-8">
        {notice && <Notice tone="info">{notice}</Notice>}
        <p className="font-display text-2xl">Your cart is empty.</p>
        <p className="text-ink-soft">Pick a ready piece, or ask for something made just for you.</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href="/products">Browse the collection</Link></Button>
          <Button asChild variant="secondary"><Link href="/#custom">Request a custom piece</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <div className="grid gap-2">
        {notice && <Notice className="mb-4">{notice}</Notice>}
        <ul className="grid divide-y-2 divide-line">
          {items.map(({ product, quantity }) => (
            <li key={product.id} className="grid grid-cols-[5rem_1fr] gap-4 py-5 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
              <ProductArt title={product.title} category={product.category} imagePath={product.image_path} sizes="96px" className="rounded-2xl" />
              <div className="grid gap-1">
                <Link href={`/products/${product.id}`} className="font-semibold hover:underline">{product.title}</Link>
                <p className="text-ink-soft">{formatPeso(product.price_cents)} each{product.is_preorder ? ", made to order" : ""}</p>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex items-center rounded-full border-2 border-line" role="group" aria-label={`Quantity of ${product.title}`}>
                    <button type="button" className="size-9 rounded-full hover:bg-petal" aria-label="One fewer"
                      onClick={() => cart.set(product.id, quantity - 1)}>−</button>
                    <span className="w-7 text-center font-semibold">{quantity}</span>
                    <button type="button" className="size-9 rounded-full hover:bg-petal disabled:opacity-40" aria-label="One more"
                      disabled={quantity >= maxFor(product)} onClick={() => cart.set(product.id, quantity + 1)}>+</button>
                  </div>
                  <button type="button" className="text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-alert"
                    onClick={() => cart.remove(product.id)}>Remove</button>
                </div>
              </div>
              <p className="col-start-2 font-bold sm:col-start-auto sm:text-right">{formatPeso(product.price_cents * quantity)}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="grid h-fit gap-4 rounded-[var(--radius-tile)] bg-white p-6 ring-2 ring-line">
        <p className="flex justify-between text-lg">
          <span>Subtotal</span>
          <span className="font-bold">{formatPeso(subtotal)}</span>
        </p>
        <p className="text-sm text-ink-soft">Coupons are applied at checkout. Delivery fees are confirmed by message.</p>
        <Button asChild size="lg"><Link href="/checkout">Check out</Link></Button>
      </aside>
    </div>
  );
}
