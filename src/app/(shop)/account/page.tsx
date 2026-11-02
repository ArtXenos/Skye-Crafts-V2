import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogOutButton } from "@/components/shop/auth-forms";
import { EditRequestForm } from "@/components/shop/public-forms";
import { StatusBadge } from "@/components/shop/status-badge";
import { Notice } from "@/components/ui/form";
import { requireUser } from "@/lib/auth";
import { getMyCustomRequests, getMyOrders } from "@/lib/data/orders";
import { formatPeso } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "My orders", robots: { index: false } };

const NOTICES: Record<string, string> = {
  "password-updated": "Your password was changed.",
  welcome: "Welcome! Your account is ready.",
};

async function Account({ searchParams }: Pick<PageProps<"/account">, "searchParams">) {
  const user = await requireUser("/account");
  const [{ notice }, orders, requests] = await Promise.all([searchParams, getMyOrders(), getMyCustomRequests()]);
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;

  return (
    <div className="grid gap-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Hi, {user.username}</h1>
          <p className="text-ink-soft">Signed in as {user.email}</p>
        </div>
        <LogOutButton />
      </div>
      {message && <Notice tone="success">{message}</Notice>}

      <section aria-labelledby="orders-heading" className="grid gap-4">
        <h2 id="orders-heading" className="text-3xl">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-ink-soft">
            No orders yet. <Link href="/products" className="font-semibold text-ink underline decoration-bloom-deep underline-offset-4">Find a piece to gift</Link>.
          </p>
        ) : (
          <ul className="grid divide-y-2 divide-line rounded-[var(--radius-tile)] bg-white ring-2 ring-line">
            {orders.map((order) => {
              const count = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
              const needsReceipt = order.status === "Placed" && order.payment_method === "gcash" && !order.receipt_path;
              return (
                <li key={order.id}>
                  <Link href={`/account/orders/${order.id}`} className="grid gap-2 p-5 hover:bg-petal/50 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="grid gap-1">
                      <p className="font-semibold">Order #{order.id}</p>
                      <p className="text-sm text-ink-soft">
                        {formatDateTime(order.created_at)}, {count} piece{count === 1 ? "" : "s"}, {formatPeso(order.total_cents)}
                      </p>
                      {needsReceipt && <p className="text-sm font-semibold text-bloom-deep">Waiting for your GCash payment</p>}
                    </div>
                    <StatusBadge status={order.status} fulfillment={order.fulfillment} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="requests-heading" className="grid gap-4">
        <h2 id="requests-heading" className="text-3xl">Custom requests</h2>
        {requests.length === 0 ? (
          <p className="text-ink-soft">
            None yet. <Link href="/#custom" className="font-semibold text-ink underline decoration-bloom-deep underline-offset-4">Request a custom piece</Link>.
          </p>
        ) : (
          <ul className="grid gap-4">
            {requests.map((request) => (
              <li key={request.id} className="grid gap-2 rounded-[var(--radius-tile)] bg-white p-5 ring-2 ring-line">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{request.occasion || "Custom piece"}, sent {formatDateTime(request.created_at)}</p>
                  <span className="rounded-full bg-petal px-3 py-1 text-sm font-semibold">{request.status}</span>
                </div>
                <p className="line-clamp-3 text-ink-soft">{request.details}</p>
                {request.quote_cents !== null && <p className="font-semibold">Quote: {formatPeso(request.quote_cents)}</p>}
                {request.shop_note && <p className="rounded-[var(--radius-field)] bg-petal px-4 py-3">From the shop: {request.shop_note}</p>}
                {request.status === "New" || request.status === "Quoted" ? (
                  <EditRequestForm request={request} />
                ) : (
                  <p className="text-sm text-ink-soft">This request is locked. Contact the shop to change it.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AccountPage(props: PageProps<"/account">) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <Suspense fallback={<p className="text-ink-soft">Loading your orders…</p>}>
        <Account searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
