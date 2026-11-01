import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

async function AdminCoupons({ searchParams }: PageProps<"/admin/coupons">) {
  await requireAdmin();
  const { saved, deleted } = await searchParams;
  const supabase = await createClient();
  const { data: coupons, error } = await supabase.from("coupons").select("*").order("id", { ascending: false });
  if (error) throw new Error(error.message);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Coupons</h1>
        <Button asChild><Link href="/admin/coupons/new">Create a coupon</Link></Button>
      </div>
      {saved && <Notice tone="success">Coupon saved.</Notice>}
      {deleted && <Notice tone="success">Coupon deleted.</Notice>}
      {coupons.length === 0 ? (
        <p className="rounded-2xl bg-petal p-6">No coupons yet. Create one for a sale or a returning customer.</p>
      ) : (
        <ul className="grid divide-y-2 divide-line rounded-2xl ring-2 ring-line">
          {coupons.map((coupon) => {
            const running = coupon.is_active && coupon.starts_on <= today && today <= coupon.ends_on &&
              (coupon.max_uses === 0 || coupon.used_count < coupon.max_uses);
            return (
              <li key={coupon.id}>
                <Link href={`/admin/coupons/${coupon.id}`} className="grid gap-1 p-4 hover:bg-paper sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-bold tracking-wide">{coupon.code}</p>
                    <p className="text-sm text-ink-soft">
                      {coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `${formatPeso(coupon.discount_value)} off`}
                      {coupon.min_order_cents > 0 && `, orders from ${formatPeso(coupon.min_order_cents)}`}
                      , {formatDate(coupon.starts_on)} to {formatDate(coupon.ends_on)}
                    </p>
                  </div>
                  <p className="text-sm">
                    <span className={running ? "font-semibold text-leaf" : "text-ink-soft"}>{running ? "Running" : "Not running"}</span>
                    , used {coupon.used_count}{coupon.max_uses ? ` of ${coupon.max_uses}` : ""}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AdminCouponsPage(props: PageProps<"/admin/coupons">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <AdminCoupons {...props} />
    </Suspense>
  );
}
