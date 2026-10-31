import { connection } from "next/server";
import Link from "next/link";
import { CouponForm } from "@/components/admin/coupon-form";

export default async function NewCouponPage() {
  await connection(); // "today" must be the visit's date, not the build's
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  return (
    <div className="grid max-w-3xl gap-6">
      <Link href="/admin/coupons" className="w-fit text-sm underline decoration-line underline-offset-4">All coupons</Link>
      <h1 className="text-3xl">Create a coupon</h1>
      <CouponForm couponId={null} initial={{
        code: "", discount_type: "percentage", discount_value: "10", max_discount: "", min_order: "",
        max_uses: 0, once_per_customer: true, starts_on: today, ends_on: today, is_active: true,
      }} />
    </div>
  );
}
