import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCart } from "@/components/shop/add-to-cart";
import { ProductArt } from "@/components/shop/art";
import { stockLabel } from "@/components/shop/product-card";
import { ReviewForm } from "@/components/shop/review-form";
import { Stars } from "@/components/shop/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { getProduct, getProducts, getPublicSettings, getReviews } from "@/lib/data/catalog";
import { formatPeso } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

function parseId(value: string) {
  return /^[1-9][0-9]{0,15}$/.test(value) ? Number(value) : null;
}

// Build a page for every current product; newer ones are built on first visit.
export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ id: String(product.id) }));
}

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const id = parseId((await params).id);
  const product = id ? await getProduct(id) : null;
  if (!product) return { title: "Piece not found" };
  return { title: product.title, description: product.description };
}

/** Only customers who received this piece see the review form. */
async function ReviewGate({ productId }: { productId: number }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <p className="text-ink-soft">
        Bought this piece? <Link href={`/login?next=/products/${productId}`} className="font-semibold text-ink underline decoration-bloom-deep underline-offset-4">Log in</Link> to review it once it arrives.
      </p>
    );
  }
  const supabase = await createClient();
  const { data: canReview } = await supabase.rpc("can_review", { p_product_id: productId });
  if (!canReview) {
    return <p className="text-ink-soft">You can review this piece after your order of it arrives.</p>;
  }
  return <ReviewForm productId={productId} />;
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const id = parseId((await params).id);
  const product = id ? await getProduct(id) : null;
  if (!product) notFound();

  const [reviews, settings] = await Promise.all([getReviews(product.id), getPublicSettings()]);
  const stock = stockLabel(product);
  const average = reviews.length ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10 : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft">
        <Link href="/products" className="underline decoration-line underline-offset-4 hover:decoration-ink">The collection</Link>
        <span aria-hidden="true"> / </span>
        <span>{product.category}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <ProductArt title={product.title} category={product.category} imagePath={product.image_path} priority
          sizes="(min-width: 768px) 50vw, 100vw" />
        <div className="grid content-start gap-5">
          <h1 className="text-4xl sm:text-5xl">{product.title}</h1>
          <p className="flex flex-wrap items-baseline gap-x-4">
            <span className="text-3xl font-bold">{formatPeso(product.price_cents)}</span>
            <span className={`font-semibold ${stock.tone}`}>{stock.text}</span>
          </p>
          {average !== null && (
            <a href="#reviews" className="w-fit text-ink-soft hover:text-ink">
              <Stars rating={average} /> {average} from {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </a>
          )}
          <p className="max-w-prose text-lg">{product.description}</p>
          <AddToCart productId={product.id} title={product.title} stock={product.stock} isPreorder={product.is_preorder} />
          <dl className="grid gap-3 border-t-2 border-line pt-5 text-[0.95rem]">
            <div>
              <dt className="font-semibold">When it&apos;s ready</dt>
              <dd className="text-ink-soft">{product.is_preorder ? settings.lead_time_custom : settings.lead_time_ready}</dd>
            </div>
            <div>
              <dt className="font-semibold">Getting it to you</dt>
              <dd className="text-ink-soft">Pickup or delivery within {settings.public_area}. {settings.shipping_note}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section id="reviews" aria-labelledby="reviews-heading" className="mt-20 grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 id="reviews-heading" className="mb-6 text-3xl">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-ink-soft">No reviews yet. Customers can review a piece once it has arrived.</p>
          ) : (
            <ul className="grid gap-6">
              {reviews.map((review) => (
                <li key={review.id} className="grid gap-1 border-t-2 border-line pt-4">
                  <p><Stars rating={review.rating} /> <span className="font-semibold">{review.username}</span></p>
                  {review.body && <p className="max-w-prose">{review.body}</p>}
                  <p className="text-sm text-ink-soft">{formatDate(review.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <Suspense fallback={<p className="text-ink-soft">Checking whether you can review this piece…</p>}>
            <ReviewGate productId={product.id} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
