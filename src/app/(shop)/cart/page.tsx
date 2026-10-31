import type { Metadata } from "next";
import { CartView } from "@/components/shop/cart-view";
import { getProducts } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default async function CartPage() {
  const products = await getProducts();
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h1 className="mb-8 text-4xl">Your cart</h1>
      <CartView products={products} />
    </div>
  );
}
