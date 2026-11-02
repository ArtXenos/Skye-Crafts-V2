import Link from "next/link";
import type { Product, RatingSummary } from "@/lib/data/catalog";
import { formatPeso } from "@/lib/money";
import { ProductArt } from "./art";
import { Stars } from "./status-badge";

export function stockLabel(product: Pick<Product, "is_preorder" | "stock">) {
  if (product.is_preorder) return { text: "Made to order", tone: "text-wire" };
  if (product.stock <= 0) return { text: "Sold out", tone: "text-ink-soft" };
  if (product.stock <= 3) return { text: `Only ${product.stock} left`, tone: "text-bloom-deep" };
  return { text: "Stock available", tone: "text-leaf" };
}

export function ProductCard({ product, rating }: { product: Product; rating?: RatingSummary }) {
  const stock = stockLabel(product);
  return (
    // The whole card is clickable (the link stretches over it); the card shows
    // the keyboard focus ring for it.
    <article className="relative grid gap-3 rounded-[var(--radius-tile)] outline-offset-4 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-bloom-deep">
      <ProductArt title={product.title} category={product.category} imagePath={product.image_path} />
      <div className="grid gap-1">
        <h3 className="font-sans text-lg font-semibold leading-snug">
          <Link href={`/products/${product.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {product.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-bold">{formatPeso(product.price_cents)}</span>
          <span className={`text-sm font-semibold ${stock.tone}`}>{stock.text}</span>
        </p>
        {rating && (
          <p className="text-sm text-ink-soft">
            <Stars rating={rating.average} /> {rating.average} from {rating.count} review{rating.count === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </article>
  );
}
