import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <Link href="/admin/products" className="w-fit text-sm underline decoration-line underline-offset-4">All products</Link>
      <h1 className="text-3xl">Add a product</h1>
      <p className="text-ink-soft">Every piece needs a real photo: take one with the camera or choose a saved one.</p>
      <ProductForm productId={null}
        initial={{ title: "", description: "", category: "Bouquets", price: "", stock: 0, is_preorder: false, is_active: true }} />
    </div>
  );
}
