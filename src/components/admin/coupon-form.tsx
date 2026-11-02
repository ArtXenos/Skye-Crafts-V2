"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { deleteCoupon, saveCoupon } from "@/app/actions/admin";
import { formResolver } from "@/components/form-resolver";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Notice, Select } from "@/components/ui/form";
import { useActionForm } from "@/components/use-action-form";
import { couponSchema, type CouponInput } from "@/lib/validation";

export function CouponForm({ couponId, initial, usedCount = 0 }: { couponId: number | null; initial: CouponInput; usedCount?: number }) {
  const form = useForm<CouponInput>({ resolver: formResolver(couponSchema), defaultValues: initial });
  const { submit, pending, message } = useActionForm(form, (values: CouponInput) => saveCoupon(couponId, values));
  const errors = form.formState.errors;
  const percentage = useWatch({ control: form.control, name: "discount_type" }) === "percentage";

  // Clear the "create a coupon" form when the page is left (see ProductForm).
  const isNew = !couponId;
  const resetRef = useRef(() => form.reset(initial));
  useLayoutEffect(() => () => {
    if (isNew) resetRef.current();
  }, [isNew]);

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Code" hint="Customers type this at checkout. Letters, numbers, - and _." error={errors.code?.message}>
          {(p) => <Input className="uppercase" autoComplete="off" {...p} {...form.register("code")} />}
        </Field>
        <Field label="Type of discount" error={errors.discount_type?.message}>
          {(p) => (
            <Select {...p} {...form.register("discount_type")}>
              <option value="percentage">Percentage off</option>
              <option value="fixed">Fixed amount off (₱)</option>
            </Select>
          )}
        </Field>
        <Field label={percentage ? "Percent off" : "Amount off (₱)"} error={errors.discount_value?.message}>
          {(p) => <Input inputMode="decimal" placeholder={percentage ? "10" : "50"} {...p} {...form.register("discount_value")} />}
        </Field>
        {percentage && (
          <Field label="Discount Cap (₱)" optional
            hint="The most this coupon can deduct from one order (percentage coupons only). Leave empty for no cap."
            error={errors.max_discount?.message}>
            {(p) => <Input inputMode="decimal" {...p} {...form.register("max_discount")} />}
          </Field>
        )}
        <Field label="Minimum order (₱)" optional error={errors.min_order?.message}>
          {(p) => <Input inputMode="decimal" {...p} {...form.register("min_order")} />}
        </Field>
        <Field label="Usage Limit"
          hint={`How many times this coupon can be used in total. With 'One use per customer' on, this is also how many customers can use it. 0 = unlimited.${usedCount ? ` Used ${usedCount} time${usedCount === 1 ? "" : "s"} so far.` : ""}`}
          error={errors.max_uses?.message}>
          {(p) => <Input type="number" min={0} step={1} {...p} {...form.register("max_uses")} />}
        </Field>
        <Field label="First day" hint="Philippine time." error={errors.starts_on?.message}>
          {(p) => <Input type="date" {...p} {...form.register("starts_on")} />}
        </Field>
        <Field label="Last day" error={errors.ends_on?.message}>
          {(p) => <Input type="date" {...p} {...form.register("ends_on")} />}
        </Field>
      </div>
      <div className="grid gap-2">
        <Checkbox label="Each customer can use it only once" {...form.register("once_per_customer")} />
        <Checkbox label="Active" {...form.register("is_active")} />
      </div>
      {message?.tone === "error" && <Notice tone="error">{message.text}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : couponId ? "Save changes" : "Create coupon"}</Button>
      </div>
    </form>
  );
}

export function DeleteCouponButton({ couponId }: { couponId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!confirming) return <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>Delete coupon</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-alert">Delete it? Past orders keep their discount.</span>
      <Button variant="danger" size="sm" disabled={pending}
        onClick={() => startTransition(async () => {
          const result = await deleteCoupon(couponId);
          if (result && !result.ok) toast.error(result.message);
        })}>
        Yes, delete
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep it</Button>
    </div>
  );
}
