import type { Metadata } from "next";
import { Catalogue } from "@/components/shop/catalogue";
import { ProductCard } from "@/components/shop/product-card";
import { getProducts, getRatings } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Shop",
  description: "Every fuzzy-wire bouquet, keychain, pot and figurine in the Skye Crafts shop.",
};

export default async function ProductsPage() {
  const [products, ratings] = await Promise.all([getProducts(), getRatings()]);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h1 className="mb-2 text-4xl sm:text-5xl">The collection</h1>
      <p className="mb-10 max-w-prose text-ink-soft">
        Each piece is shaped by hand, so colours can vary a little from the photos. Made-to-order pieces are crafted
        after you order.
      </p>
      <Catalogue
        items={products.map((product) => ({
          product,
          card: <ProductCard product={product} rating={ratings[product.id]} />,
        }))}
      />
    </div>
  );
}
