import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProductButton, ProductForm, ProductPhotoEditor } from "@/components/admin/product-form";
import { Notice } from "@/components/ui/form";
import { productImageUrl } from "@/lib/env";
import { centsToPesoInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[1-9][0-9]{0,15}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("id", Number(id)).maybeSingle();
  if (!product) notFound();

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <Link href="/admin/products" className="w-fit text-sm underline decoration-line underline-offset-4">All products</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl">{product.title}</h1>
          {product.is_active && <Link href={`/products/${product.id}`} className="text-sm font-semibold underline decoration-bloom-deep underline-offset-4">See it in the shop</Link>}
        </div>
        {created && <Notice tone="success">Product added with its photo.</Notice>}
      </div>
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <ProductForm productId={product.id} loadedAt={product.updated_at} initial={{
          title: product.title, description: product.description, category: product.category as never,
          price: centsToPesoInput(product.price_cents), stock: product.stock,
          is_preorder: product.is_preorder, is_active: product.is_active,
        }} />
        <div className="grid content-start gap-5">
          {/* key: start fresh after the photo changes */}
          <ProductPhotoEditor key={product.image_path ?? "none"} productId={product.id} currentUrl={productImageUrl(product.image_path)} />
          <div className="border-t-2 border-line pt-5">
            <DeleteProductButton productId={product.id} title={product.title} />
          </div>
        </div>
      </div>
    </div>
  );
}
