import Link from "next/link";
import { Suspense } from "react";
import { ProductForm } from "@/components/admin/product-form";
import { CATEGORIES, CATEGORY_SLUGS, type Category } from "@/lib/shop";

// /admin/products/new?category=fuzzy-wire-pots starts the form in that category.
async function NewProduct({ searchParams }: PageProps<"/admin/products/new">) {
  const { category: slug } = await searchParams;
  const category: Category = CATEGORIES.find((name) => CATEGORY_SLUGS[name] === slug) ?? "Flower Bouquets";
  return (
    <div className="grid max-w-2xl gap-6">
      <Link href="/admin/products" className="w-fit text-sm underline decoration-line underline-offset-4">All products</Link>
      <h1 className="text-3xl">Add a product</h1>
      <p className="text-ink-soft">
        Add each variety as its own product, with its own name, photo, price and stock. Every piece needs a real photo:
        take one with the camera or choose a saved one.
      </p>
      {/* key: a different category link starts a fresh form */}
      <ProductForm key={category} productId={null}
        initial={{ title: "", description: "", category, price: "", stock: 0, is_preorder: false, is_active: true }} />
    </div>
  );
}

export default function NewProductPage(props: PageProps<"/admin/products/new">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <NewProduct {...props} />
    </Suspense>
  );
}
