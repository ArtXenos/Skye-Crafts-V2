import Link from "next/link";
import { Suspense } from "react";
import { ProductArt } from "@/components/shop/art";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const { deleted } = await searchParams;
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, category, price_cents, stock, is_preorder, is_active, image_path")
    .order("id");
  if (error) throw new Error(error.message);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Products</h1>
        <Button asChild><Link href="/admin/products/new">Add a product</Link></Button>
      </div>
      {deleted && <Notice tone="success">Product deleted.</Notice>}
      <p className="text-ink-soft">Stock goes down when someone orders and back up if the order is declined, cancelled or expires.</p>
      <ul className="grid divide-y-2 divide-line rounded-2xl ring-2 ring-line">
        {products.map((product) => (
          <li key={product.id}>
            <Link href={`/admin/products/${product.id}`} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 p-4 hover:bg-paper">
              <ProductArt title={product.title} category={product.category} imagePath={product.image_path} sizes="56px" className="rounded-xl" />
              <div>
                <p className="font-semibold">{product.title}</p>
                <p className="text-sm text-ink-soft">
                  {product.category}, {formatPeso(product.price_cents)}
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
