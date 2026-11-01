import Link from "next/link";
import { Suspense } from "react";
import { ProductArt } from "@/components/shop/art";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { CATEGORIES, CATEGORY_BLURBS, categorySlug } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const { deleted } = await searchParams;
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, category, price_cents, stock, is_preorder, is_active, image_path")
    .order("title");
  if (error) throw new Error(error.message);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Products</h1>
        <Button asChild><Link href="/admin/products/new">Add a product</Link></Button>
      </div>
      {deleted && <Notice tone="success">Product deleted.</Notice>}
      <p className="text-ink-soft">Stock goes down when someone orders and back up if the order is declined, cancelled or expires.</p>
      {CATEGORIES.map((category) => {
        const inCategory = products.filter((product) => product.category === category);
        const headingId = `${categorySlug(category)}-heading`;
        return (
          <section key={category} aria-labelledby={headingId} className="grid gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id={headingId} className="text-2xl">
                  {category} <span className="font-sans text-base font-normal text-ink-soft">{inCategory.length} {inCategory.length === 1 ? "variety" : "varieties"}</span>
                </h2>
                <p className="text-sm text-ink-soft">{CATEGORY_BLURBS[category]}</p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/admin/products/new?category=${categorySlug(category)}`} aria-label={`Add a variety to ${category}`}>Add a variety</Link>
              </Button>
            </div>
            {inCategory.length === 0 ? (
              <p className="rounded-2xl bg-paper p-4 text-sm text-ink-soft ring-2 ring-line">No {category.toLowerCase()} yet.</p>
            ) : (
              <ul className="grid divide-y-2 divide-line rounded-2xl ring-2 ring-line">
                {inCategory.map((product) => (
                  <li key={product.id}>
                    <Link href={`/admin/products/${product.id}`} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 p-4 hover:bg-paper">
                      <ProductArt title={product.title} category={product.category} imagePath={product.image_path} sizes="56px" className="rounded-xl" />
                      <div>
                        <p className="font-semibold">{product.title}</p>
                        <p className="text-sm text-ink-soft">
                          {formatPeso(product.price_cents)}
                          {product.is_active ? "" : ", hidden from the shop"}
                        </p>
                        {!product.image_path && <p className="text-sm font-semibold text-bloom-deep">Needs a real photo</p>}
                      </div>
                      <p className={product.is_preorder ? "text-wire" : product.stock <= 3 ? "font-semibold text-bloom-deep" : ""}>
                        {product.is_preorder ? "Made to order" : `${product.stock} in stock`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function AdminProductsPage(props: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <AdminProducts {...props} />
    </Suspense>
  );
}
