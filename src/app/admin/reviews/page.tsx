import Link from "next/link";
import { Suspense } from "react";
import { RemoveButton } from "@/components/admin/small-forms";
import { Stars } from "@/components/shop/status-badge";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

async function AdminReviews() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, product_id, products(title), profiles(username)")
    .order("id", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">Reviews</h1>
      <p className="text-ink-soft">Only customers who received a piece can review it. Remove anything abusive or off-topic.</p>
      {reviews.length === 0 ? (
        <p className="rounded-2xl bg-petal p-6">No reviews yet.</p>
      ) : (
        <ul className="grid divide-y-2 divide-line rounded-2xl ring-2 ring-line">
          {reviews.map((review) => (
            <li key={review.id} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p><Stars rating={review.rating} /> <span className="font-semibold">{review.profiles?.username}</span> on{" "}
                  <Link href={`/products/${review.product_id}`} className="underline decoration-bloom-deep underline-offset-4">{review.products?.title}</Link></p>
                {review.body && <p className="max-w-prose">{review.body}</p>}
                <p className="text-sm text-ink-soft">{formatDateTime(review.created_at)}</p>
              </div>
              <RemoveButton id={review.id} kind="review" label={`Remove ${review.profiles?.username ?? "this"}'s review`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <AdminReviews />
    </Suspense>
  );
}
