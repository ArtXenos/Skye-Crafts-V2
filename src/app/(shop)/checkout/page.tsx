import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { requireUser } from "@/lib/auth";
import { getProducts, getPublicSettings } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function Checkout() {
  const user = await requireUser("/checkout");
  const [products, settings] = await Promise.all([getProducts(), getPublicSettings()]);
  return <CheckoutForm products={products} settings={settings} email={user.email} />;
}

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h1 className="mb-8 text-4xl">Checkout</h1>
      <Suspense fallback={<p className="text-ink-soft">Loading your cart…</p>}>
        <Checkout />
      </Suspense>
    </div>
  );
}
