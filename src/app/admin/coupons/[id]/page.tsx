import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CouponForm, DeleteCouponButton } from "@/components/admin/coupon-form";
import { requireAdmin } from "@/lib/auth";
import { centsToPesoInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function EditCoupon({ params }: PageProps<"/admin/coupons/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[1-9][0-9]{0,15}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: coupon } = await supabase.from("coupons").select("*").eq("id", Number(id)).maybeSingle();
  if (!coupon) notFound();
  const percentage = coupon.discount_type === "percentage";

  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/admin/coupons" className="w-fit text-sm underline decoration-line underline-offset-4">All coupons</Link>
      <h1 className="text-3xl">{coupon.code}</h1>
      <CouponForm couponId={coupon.id} usedCount={coupon.used_count} initial={{
        code: coupon.code,
        discount_type: coupon.discount_type as "percentage" | "fixed",
        discount_value: percentage ? String(coupon.discount_value) : centsToPesoInput(coupon.discount_value),
        max_discount: coupon.max_discount_cents ? centsToPesoInput(coupon.max_discount_cents) : "",
        min_order: coupon.min_order_cents ? centsToPesoInput(coupon.min_order_cents) : "",
        max_uses: coupon.max_uses, once_per_customer: coupon.once_per_customer,
        starts_on: coupon.starts_on, ends_on: coupon.ends_on, is_active: coupon.is_active,
      }} />
      <div className="border-t-2 border-line pt-5"><DeleteCouponButton couponId={coupon.id} /></div>
    </div>
  );
}

export default function EditCouponPage(props: PageProps<"/admin/coupons/[id]">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <EditCoupon {...props} />
    </Suspense>
  );
}
