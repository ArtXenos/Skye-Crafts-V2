import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusActions } from "@/components/admin/order-status-actions";
import { StatusBadge } from "@/components/shop/status-badge";
import { Notice } from "@/components/ui/form";
import { formatPeso } from "@/lib/money";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id: rawId } = await params;
  if (!/^[1-9][0-9]{0,15}$/.test(rawId)) notFound();
  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(`*, profiles(username), order_items(id, product_id, title, price_cents, quantity, is_preorder)`)
    .eq("id", Number(rawId))
    .order("id", { referencedTable: "order_items" })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) notFound();
  // History with admin names (customers can't see who on the team acted).
  const { data: events } = await supabase.rpc("admin_order_events", { p_order_id: order.id });

  // Receipts are private: a link that works for 10 minutes.
  const receiptUrl = order.receipt_path
    ? (await supabase.storage.from("receipts").createSignedUrl(order.receipt_path, 600)).data?.signedUrl
    : null;
  const pickup = order.fulfillment === "pickup";

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <Link href="/admin" className="w-fit text-sm underline decoration-line underline-offset-4">All orders</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl">Order #{order.id}</h1>
          <StatusBadge status={order.status} fulfillment={order.fulfillment} admin />
        </div>
        <p className="text-ink-soft">
          Placed {formatDateTime(order.created_at)} by account {order.profiles?.username} ({order.buyer_email || "no email"})
        </p>
        {order.status === "Placed" && order.expires_at && !order.receipt_path && (
          <Notice>Cancels automatically at {formatDateTime(order.expires_at)} unless you confirm it or a receipt is uploaded.</Notice>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid content-start gap-8">
          <section className="grid gap-3 rounded-2xl p-5 ring-2 ring-line" aria-labelledby="next-heading">
            <h2 id="next-heading" className="font-sans text-lg font-bold">Next step</h2>
            <OrderStatusActions orderId={order.id} status={order.status} />
          </section>

          <section className="grid gap-3" aria-labelledby="items-heading">
            <h2 id="items-heading" className="font-sans text-lg font-bold">Pieces</h2>
            <ul className="grid divide-y-2 divide-line">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-2">
                  <span>{item.title} <span className="text-ink-soft">× {item.quantity}</span>{item.is_preorder && <span className="text-sm text-wire"> (made to order)</span>}</span>
                  <span className="font-semibold">{formatPeso(item.price_cents * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid gap-1 border-t-2 border-line pt-2">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPeso(order.subtotal_cents)}</dd></div>
              {order.discount_cents > 0 && <div className="flex justify-between"><dt>Coupon {order.coupon_code}</dt><dd>−{formatPeso(order.discount_cents)}</dd></div>}
              <div className="flex justify-between text-lg font-bold"><dt>Total to collect</dt><dd>{formatPeso(order.total_cents)}</dd></div>
            </dl>
          </section>

          <section className="grid gap-3" aria-labelledby="history-heading">
            <h2 id="history-heading" className="font-sans text-lg font-bold">History</h2>
            <ol className="grid gap-3 border-l-4 border-bloom pl-5">
              {(events ?? []).map((event) => (
                <li key={event.id}>
                  <p className="font-semibold">{event.status}{event.note ? `: ${event.note}` : ""}</p>
                  <p className="text-sm text-ink-soft">
                    {event.actor === "system" ? "Automatic" : event.actor_name ?? event.actor}, {formatDateTime(event.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <section className="grid gap-2 rounded-2xl bg-paper p-5" aria-labelledby="customer-heading">
            <h2 id="customer-heading" className="font-sans text-lg font-bold">{pickup ? "Pickup for" : "Deliver to"}</h2>
            <p className="font-semibold">{order.recipient}</p>
            <p><a href={`tel:${order.contact.replace(/[^0-9+]/g, "")}`} className="underline decoration-bloom-deep underline-offset-4">{order.contact}</a></p>
            {!pickup && <p className="whitespace-pre-line">{order.address}</p>}
            {order.note && <p className="mt-2 whitespace-pre-line rounded-xl bg-white p-3"><span className="font-semibold">Customer note:</span> {order.note}</p>}
          </section>
          <section className="grid gap-2 rounded-2xl bg-paper p-5" aria-labelledby="payment-heading">
            <h2 id="payment-heading" className="font-sans text-lg font-bold">Payment: {PAYMENT_LABEL[order.payment_method as PaymentMethod]}</h2>
            {receiptUrl ? (
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="grid gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; not worth optimising */}
                <img src={receiptUrl} alt={`GCash receipt for order ${order.id}`} className="max-h-96 w-full rounded-xl object-contain ring-2 ring-line" />
                <span className="text-sm underline underline-offset-4">Open full size (link works for 10 minutes)</span>
              </a>
            ) : order.payment_method === "gcash" ? (
              <p className="text-ink-soft">No receipt uploaded yet. Check your GCash history for {formatPeso(order.total_cents)} before confirming.</p>
            ) : (
              <p className="text-ink-soft">Collect {formatPeso(order.total_cents)} in cash at pickup.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
