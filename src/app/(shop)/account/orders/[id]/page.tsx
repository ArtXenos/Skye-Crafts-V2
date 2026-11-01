import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PickupMap } from "@/components/map/pickup-map";
import { CancelOrderButton, ConfirmReceiptButton, ReceiptUpload } from "@/components/shop/order-actions";
import { StatusBadge } from "@/components/shop/status-badge";
import { Notice } from "@/components/ui/form";
import { requireUser } from "@/lib/auth";
import { getMyOrder, getOrderPrivateDetails } from "@/lib/data/orders";
import { formatPeso } from "@/lib/money";
import { CUSTOMER_CANCELLABLE, customerStatusLabel, PAYMENT_LABEL, type PaymentMethod } from "@/lib/shop";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

const ACTOR = { customer: "You", shop: "Skye Crafts", system: "Automatic" } as const;

async function OrderDetail({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  const { id: rawId } = await params;
  const id = /^[1-9][0-9]{0,15}$/.test(rawId) ? Number(rawId) : null;
  await requireUser(`/account/orders/${rawId}`);
  if (!id) notFound();

  const [order, details, { placed }] = await Promise.all([getMyOrder(id), getOrderPrivateDetails(id), searchParams]);
  if (!order) notFound(); // also when it's someone else's order: RLS hides it

  const pickup = order.fulfillment === "pickup";
  const awaitingGcash = order.status === "Placed" && order.payment_method === "gcash";

  return (
    <div className="grid gap-10">
      <div className="grid gap-3">
        <Link href="/account" className="w-fit text-sm text-ink-soft underline decoration-line underline-offset-4 hover:decoration-ink">All orders</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl">Order #{order.id}</h1>
          <StatusBadge status={order.status} fulfillment={order.fulfillment} />
        </div>
        <p className="text-ink-soft">Placed {formatDateTime(order.created_at)}</p>
        {placed && <Notice tone="success">Thank you! Your order is in. {awaitingGcash ? "Pay by GCash below to have it confirmed." : "The shop will confirm it soon."}</Notice>}
        {order.status_note && order.status !== "Placed" && (
          <Notice>Note from the shop: {order.status_note}</Notice>
        )}
      </div>

      {awaitingGcash && (
        <section aria-labelledby="pay-heading" className="grid gap-5 rounded-[var(--radius-tile)] bg-white p-6 ring-2 ring-bloom">
          <h2 id="pay-heading" className="text-2xl">Pay with GCash</h2>
          {details.gcash_number ? (
            <dl className="grid gap-1 text-lg">
              <div className="flex flex-wrap gap-x-2"><dt className="text-ink-soft">Send</dt><dd className="font-bold">{formatPeso(order.total_cents)}</dd></div>
              <div className="flex flex-wrap gap-x-2"><dt className="text-ink-soft">To GCash number</dt><dd className="font-bold tracking-wide">{details.gcash_number}</dd></div>
              {details.gcash_name && <div className="flex flex-wrap gap-x-2"><dt className="text-ink-soft">Account name</dt><dd className="font-semibold">{details.gcash_name}</dd></div>}
            </dl>
          ) : (
            <p>The shop will message you with their GCash details.</p>
          )}
          {order.receipt_path ? (
            <Notice tone="success">We have your payment screenshot. The shop will confirm your order after checking it.</Notice>
          ) : (
            order.expires_at && (
              <p className="text-ink-soft">Please pay and upload your screenshot by {formatDateTime(order.expires_at)}, or the order is cancelled automatically.</p>
            )
          )}
          <ReceiptUpload orderId={order.id} hasReceipt={Boolean(order.receipt_path)} />
        </section>
      )}

      {order.status === "Placed" && order.payment_method === "cash_on_pickup" && order.expires_at && (
        <Notice>
          The shop will confirm your order by {formatDateTime(order.expires_at)}. If it isn&apos;t confirmed by then, it is
          cancelled automatically and you&apos;re free to order again.
        </Notice>
      )}

      {pickup && details.pickup_location && (
        <section aria-labelledby="pickup-heading" className="grid gap-2 rounded-[var(--radius-tile)] bg-leaf-soft p-6">
          <h2 id="pickup-heading" className="text-2xl">Where to pick up</h2>
          <p className="whitespace-pre-line">{details.pickup_location}</p>
          {details.pickup_schedule && <p className="whitespace-pre-line text-ink-soft">{details.pickup_schedule}</p>}
          {details.pickup_coordinates && <PickupMap coordinates={details.pickup_coordinates} />}
        </section>
      )}

      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="items-heading" className="grid content-start gap-4">
          <h2 id="items-heading" className="text-2xl">Pieces</h2>
          <ul className="grid divide-y-2 divide-line">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 py-3">
                <span>
                  {item.product_id ? <Link href={`/products/${item.product_id}`} className="hover:underline">{item.title}</Link> : item.title}
                  <span className="text-ink-soft"> × {item.quantity}</span>
                  {item.is_preorder && <span className="text-sm text-wire"> (made to order)</span>}
                </span>
                <span className="font-semibold">{formatPeso(item.price_cents * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-1 border-t-2 border-line pt-3">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(order.subtotal_cents)}</dd></div>
            {order.discount_cents > 0 && <div className="flex justify-between text-leaf"><dt>Coupon {order.coupon_code}</dt><dd>−{formatPeso(order.discount_cents)}</dd></div>}
            <div className="flex justify-between text-xl font-bold"><dt>Total</dt><dd>{formatPeso(order.total_cents)}</dd></div>
          </dl>
          {!pickup && <p className="text-sm text-ink-soft">The delivery fee is confirmed by message.</p>}
        </section>

        <section aria-labelledby="details-heading" className="grid content-start gap-4">
          <h2 id="details-heading" className="text-2xl">Details</h2>
          <dl className="grid gap-3">
            <div><dt className="text-sm text-ink-soft">For</dt><dd>{order.recipient}, {order.contact}</dd></div>
            <div><dt className="text-sm text-ink-soft">{pickup ? "Pickup" : "Deliver to"}</dt><dd className="whitespace-pre-line">{pickup ? "Pickup (place shown once confirmed)" : order.address}</dd></div>
            <div><dt className="text-sm text-ink-soft">Payment</dt><dd>{PAYMENT_LABEL[order.payment_method as PaymentMethod] ?? order.payment_method}</dd></div>
            {order.note && <div><dt className="text-sm text-ink-soft">Your note</dt><dd className="whitespace-pre-line">{order.note}</dd></div>}
          </dl>
          <div className="flex flex-wrap gap-3">
            {order.status === "Shipped" && <ConfirmReceiptButton orderId={order.id} pickup={pickup} />}
            {CUSTOMER_CANCELLABLE.has(order.status) && <CancelOrderButton orderId={order.id} />}
          </div>
        </section>
      </div>

      <section aria-labelledby="history-heading" className="grid gap-4">
        <h2 id="history-heading" className="text-2xl">History</h2>
        <ol className="grid gap-4 border-l-4 border-bloom pl-5">
          {order.order_events.map((event) => (
            <li key={event.id} className="grid gap-0.5">
              <p className="font-semibold">{customerStatusLabel(event.status, order.fulfillment)}</p>
              <p className="text-sm text-ink-soft">{ACTOR[event.actor as keyof typeof ACTOR] ?? event.actor}, {formatDateTime(event.created_at)}</p>
              {event.note && <p className="whitespace-pre-line">{event.note}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function OrderPage(props: PageProps<"/account/orders/[id]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <Suspense fallback={<p className="text-ink-soft">Loading your order…</p>}>
        <OrderDetail {...props} />
      </Suspense>
    </div>
  );
}
