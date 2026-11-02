"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { placeOrder, quoteCoupon, type CouponQuote } from "@/app/actions/shop";
import { useCartItems } from "@/components/shop/cart-view";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Textarea } from "@/components/ui/form";
import { formResolver } from "@/components/form-resolver";
import { useActionForm } from "@/components/use-action-form";
import { cart } from "@/lib/cart";
import type { Product, PublicSettings } from "@/lib/data/catalog";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation";

function Choice({ checked, title, detail, disabled, ...input }: React.ComponentProps<"input"> & { title: string; detail: string }) {
  return (
    <label className={cn(
      "grid cursor-pointer gap-0.5 rounded-[var(--radius-field)] border-2 p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-bloom-deep",
      checked ? "border-ink bg-petal" : "border-line bg-white hover:border-bloom",
      disabled && "cursor-not-allowed opacity-50",
    )}>
      <span className="flex items-center gap-2 font-semibold">
        <input type="radio" className="accent-ink" checked={checked} disabled={disabled} {...input} />
        {title}
      </span>
      <span className="pl-6 text-sm text-ink-soft">{detail}</span>
    </label>
  );
}

export function CheckoutForm({ products, settings, email }: { products: Product[]; settings: PublicSettings; email: string }) {
  const router = useRouter();
  const { items, subtotal, notice } = useCartItems(products);
  // One key per checkout attempt: a retry after a lost connection returns the
  // first order instead of placing a second one. A new key after each order,
  // because Next.js keeps this page alive (hidden) for the next checkout.
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID());
  // The last coupon check, remembered with the cart and code it was for.
  const [couponCheck, setCouponCheck] = useState<{
    key: string;
    quote: CouponQuote | null;
    message: { tone: "error" | "success"; text: string };
  } | null>(null);
  const [checkingCoupon, startCouponCheck] = useTransition();
  const couponId = useId();

  const form = useForm<CheckoutInput>({
    resolver: formResolver(checkoutSchema),
    defaultValues: { recipient: "", contact: "", fulfillment: "delivery", address: "", payment_method: "gcash", note: "", coupon_code: "" },
  });
  const fulfillment = useWatch({ control: form.control, name: "fulfillment" });
  const payment = useWatch({ control: form.control, name: "payment_method" });
  const couponCode = useWatch({ control: form.control, name: "coupon_code" });
  const cartItems = items.map((item) => ({ product_id: item.productId, quantity: item.quantity }));
  const cartSignature = JSON.stringify(cartItems);

  // Delivery orders are paid by GCash.
  useEffect(() => {
    if (fulfillment === "delivery" && payment === "cash_on_pickup") form.setValue("payment_method", "gcash");
  }, [fulfillment, payment, form]);

  // A changed cart or code means the applied discount must be checked again,
  // so an old check only counts while both still match.
  const couponKey = `${(couponCode ?? "").trim().toUpperCase()}|${cartSignature}`;
  const current = couponCheck?.key === couponKey ? couponCheck : null;
  const quote = current?.quote ?? null;
  const couponMessage = current?.message ?? null;

  const { submit, pending, message } = useActionForm(
    form,
    (values: CheckoutInput) =>
      placeOrder({ form: { ...values, coupon_code: quote?.code ?? values.coupon_code }, items: cartItems, checkoutKey }),
    {
      onSuccess: ({ orderId }) => {
        setCheckoutKey(crypto.randomUUID());
        cart.clear();
        router.push(`/account/orders/${orderId}?placed=1`);
      },
    },
  );

  function applyCoupon() {
    const key = couponKey;
    startCouponCheck(async () => {
      const result = await quoteCoupon({ code: couponCode, items: cartItems });
      setCouponCheck(
        result.ok
          ? { key, quote: result.data, message: { tone: "success", text: `${result.data.code} applied: you save ${formatPeso(result.data.discount_cents)}.` } }
          : { key, quote: null, message: { tone: "error", text: result.message } },
      );
    });
  }

  if (items.length === 0) {
    return (
      <div className="grid justify-items-start gap-4 rounded-[var(--radius-tile)] bg-petal p-8">
        {notice && <Notice>{notice}</Notice>}
        <p className="font-display text-2xl">Your cart is empty.</p>
        <Button asChild><Link href="/products">Browse the collection</Link></Button>
      </div>
    );
  }

  const errors = form.formState.errors;
  const discount = quote?.discount_cents ?? 0;
  const hours = settings.unpaid_order_hours || "48";

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
      <div className="grid content-start gap-8">
        {notice && <Notice>{notice}</Notice>}

        <fieldset className="grid gap-4">
          <legend className="mb-3 font-display text-2xl">Who is it for?</legend>
          <Field label="Recipient's name" error={errors.recipient?.message}>
            {(p) => <Input autoComplete="name" {...p} {...form.register("recipient")} />}
          </Field>
          <Field label="Mobile number" hint="For delivery updates and pickup arrangements." error={errors.contact?.message}>
            {(p) => <Input type="tel" inputMode="numeric" autoComplete="tel" placeholder="09XX XXX XXXX" {...p} {...form.register("contact")} />}
          </Field>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-3 font-display text-2xl">How will you get it?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice value="delivery" title="Delivery" detail={`Within ${settings.public_area} only. The delivery fee is confirmed by message.`}
              checked={fulfillment === "delivery"} {...form.register("fulfillment")} />
            <Choice value="pickup" title="Pickup" detail={`In ${settings.public_area}. The exact place is shown once the shop confirms your order.`}
              checked={fulfillment === "pickup"} {...form.register("fulfillment")} />
          </div>
          {fulfillment === "delivery" && (
            <Field label="Delivery address" error={errors.address?.message}>
              {(p) => <Textarea rows={3} autoComplete="street-address" placeholder="House number, street, barangay, city, province" {...p} {...form.register("address")} />}
            </Field>
          )}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-3 font-display text-2xl">How will you pay?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice value="gcash" title="GCash" detail="The shop's GCash details appear right after you order. Upload your payment screenshot there."
              checked={payment === "gcash"} {...form.register("payment_method")} />
            <Choice value="cash_on_pickup" title="Cash on pickup" detail={fulfillment === "pickup" ? "Pay when you collect your order." : "Only for pickup orders."}
              checked={payment === "cash_on_pickup"} disabled={fulfillment !== "pickup"} {...form.register("payment_method")} />
          </div>
          {errors.payment_method && <p className="text-sm font-medium text-alert">{errors.payment_method.message}</p>}
        </fieldset>

        <Field label="Note for the shop" optional error={errors.note?.message}
          hint="A message for the card, a colour preference, or the date you need it.">
          {(p) => <Textarea rows={3} {...p} {...form.register("note")} />}
        </Field>
      </div>

      <aside className="grid h-fit gap-5 rounded-[var(--radius-tile)] bg-white p-6 ring-2 ring-line lg:sticky lg:top-24">
        <h2 className="text-2xl">Your order</h2>
        <ul className="grid gap-2">
          {items.map(({ product, quantity }) => (
            <li key={product.id} className="flex justify-between gap-4">
              <span>{product.title} <span className="text-ink-soft">× {quantity}</span></span>
              <span className="shrink-0 font-semibold">{formatPeso(product.price_cents * quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="grid gap-2 border-t-2 border-line pt-4">
          <label htmlFor={couponId} className="text-sm font-semibold">Coupon code <span className="font-normal text-ink-soft">(optional)</span></label>
          <div className="flex gap-2">
            <Input id={couponId} autoComplete="off" className="uppercase" {...form.register("coupon_code")} />
            <Button variant="secondary" disabled={!couponCode?.trim() || checkingCoupon} onClick={applyCoupon}>
              {checkingCoupon ? "Checking…" : "Apply"}
            </Button>
          </div>
          {couponMessage && <Notice tone={couponMessage.tone}>{couponMessage.text}</Notice>}
          {errors.coupon_code && !couponMessage && <p className="text-sm font-medium text-alert">{errors.coupon_code.message}</p>}
        </div>

        <dl className="grid gap-1 border-t-2 border-line pt-4">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(subtotal)}</dd></div>
          {discount > 0 && <div className="flex justify-between text-leaf"><dt>Coupon {quote?.code}</dt><dd>−{formatPeso(discount)}</dd></div>}
          <div className="flex justify-between text-xl font-bold"><dt>Total</dt><dd>{formatPeso(Math.max(subtotal - discount, 0))}</dd></div>
        </dl>
        <p className="text-sm text-ink-soft">
          {fulfillment === "delivery" ? `${settings.shipping_note} ` : ""}
          Orders that aren&apos;t paid or confirmed within {hours} hours are cancelled automatically.
          Updates go to {email}.
        </p>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Placing your order…" : "Place order"}</Button>
      </aside>
    </form>
  );
}
