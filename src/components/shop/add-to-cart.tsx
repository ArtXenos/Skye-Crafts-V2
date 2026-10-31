"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cart, useCart } from "@/lib/cart";
import { MAX_QUANTITY } from "@/lib/shop";

export function AddToCart({ productId, title, stock, isPreorder }: { productId: number; title: string; stock: number; isPreorder: boolean }) {
  const router = useRouter();
  const lines = useCart();
  const inCart = lines.find((line) => line.productId === productId)?.quantity ?? 0;
  const max = Math.min(isPreorder ? MAX_QUANTITY : stock, MAX_QUANTITY);
  const room = Math.max(max - inCart, 0);
  const [quantity, setQuantity] = useState(1);
  const amount = Math.min(quantity, Math.max(room, 1));

  if (max <= 0) {
    return (
      <p className="rounded-[var(--radius-field)] bg-petal px-4 py-3">
        Sold out for now.{" "}
        <Link href="/#custom" className="font-semibold underline decoration-bloom-deep underline-offset-4">Ask for one to be made</Link>.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border-2 border-line" role="group" aria-label="Quantity">
          <button type="button" className="size-11 rounded-full text-xl hover:bg-petal disabled:opacity-40" aria-label="One fewer"
            disabled={amount <= 1} onClick={() => setQuantity(Math.max(amount - 1, 1))}>−</button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{amount}</span>
          <button type="button" className="size-11 rounded-full text-xl hover:bg-petal disabled:opacity-40" aria-label="One more"
            disabled={amount >= room} onClick={() => setQuantity(Math.min(amount + 1, room))}>+</button>
        </div>
        <Button size="lg" disabled={room === 0}
          onClick={() => {
            cart.add(productId, amount, max);
            setQuantity(1);
            toast.success(`${title} added to your cart`, { action: { label: "View cart", onClick: () => router.push("/cart") } });
          }}>
          Add to cart
        </Button>
      </div>
      {inCart > 0 && (
        <p className="text-sm text-ink-soft">
          {inCart} in your cart{room === 0 ? ", which is all that's available" : ""}.{" "}
          <Link href="/cart" className="font-semibold text-ink underline decoration-bloom-deep underline-offset-4">Go to cart</Link>
        </p>
      )}
    </div>
  );
}
