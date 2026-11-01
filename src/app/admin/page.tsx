import Link from "next/link";
import { Suspense } from "react";
import { StatusBadge } from "@/components/shop/status-badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { requireAdmin } from "@/lib/auth";
import { formatPeso } from "@/lib/money";
import { ORDER_STATUSES, PAYMENT_LABEL, type PaymentMethod } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

/** Today's date in Manila as YYYY-MM-DD. */
function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/**
 * Download orders as a spreadsheet. A plain GET form: the browser asks
 * /admin/orders/export for the file, which checks the owner and the dates.
 */
function ExportOrders() {
  const today = manilaToday();
  const monthStart = `${today.slice(0, 8)}01`;
  return (
    <section aria-labelledby="export-heading" className="grid gap-4 rounded-2xl bg-paper p-5 ring-2 ring-line">
      <div className="grid gap-1">
        <h2 id="export-heading" className="text-2xl">Download for Excel or Google Sheets</h2>
        <p className="text-sm text-ink-soft">A CSV file of the orders placed between these dates (Manila time).</p>
      </div>
      <form action="/admin/orders/export" method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          From
          <Input type="date" name="from" defaultValue={monthStart} max={today} required className="w-44" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          To
          <Input type="date" name="to" defaultValue={today} max={today} required className="w-44" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Which orders
          <Select name="scope" defaultValue="sales" className="w-60">
            <option value="sales">Sales (not declined or cancelled)</option>
            <option value="all">All orders</option>
            {ORDER_STATUSES.map((value) => <option key={value} value={value}>Only {value}</option>)}
          </Select>
        </label>
        <Button type="submit" name="kind" value="orders">One row per order</Button>
        <Button type="submit" name="kind" value="items" variant="secondary">One row per piece sold</Button>
      </form>
    </section>
  );
}

const PAGE_SIZE = 20;

type Summary = {
  status_counts: Record<string, number>;
  receipts_to_check: number;
  sales_30d_cents: number;
  orders_30d: number;
  new_requests: number;
  low_stock: { id: number; title: string; stock: number }[];
};

type OrderRow = {
  id: number; status: string; recipient: string; contact: string; fulfillment: string; payment_method: string;
  total_cents: number; created_at: string; has_receipt: boolean; buyer: string; item_count: number;
};

async function AdminOrders({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const params = await searchParams;
  const status = typeof params.status === "string" && (ORDER_STATUSES as readonly string[]).includes(params.status) ? params.status : "";
  const query = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(1, Number(params.page) || 1);

  const supabase = await createClient();
  await supabase.rpc("expire_stale_orders"); // so the list never shows overdue unpaid orders
  const [{ data: summaryData }, { data: listData, error }] = await Promise.all([
    supabase.rpc("admin_summary"),
    supabase.rpc("admin_search_orders", { p_status: status, p_query: query, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE }),
  ]);
  if (error) throw new Error(error.message);
  const summary = summaryData as Summary;
  const { total, orders } = listData as { total: number; orders: OrderRow[] };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLink = (target: number) => {
    const search = new URLSearchParams({ ...(status && { status }), ...(query && { q: query }), page: String(target) });
    return `/admin?${search}`;
  };

  return (
    <div className="grid gap-10">
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin?status=Placed" className="rounded-2xl bg-[#f6ecd6] p-5 hover:ring-2 hover:ring-wire">
          <p className="text-3xl font-bold">{summary.status_counts.Placed ?? 0}</p>
          <p className="font-semibold">waiting for you to confirm</p>
          {summary.receipts_to_check > 0 && <p className="text-sm">{summary.receipts_to_check} with a GCash receipt to check</p>}
        </Link>
        <Link href="/admin?status=Approved" className="rounded-2xl bg-leaf-soft p-5 hover:ring-2 hover:ring-leaf">
          <p className="text-3xl font-bold">{(summary.status_counts.Approved ?? 0) + (summary.status_counts.Packed ?? 0)}</p>
          <p className="font-semibold">to make, pack or send</p>
        </Link>
        <div className="rounded-2xl bg-petal p-5">
          <p className="text-3xl font-bold">{formatPeso(summary.sales_30d_cents)}</p>
          <p className="font-semibold">confirmed sales, last 30 days</p>
          <p className="text-sm">{summary.orders_30d} order{summary.orders_30d === 1 ? "" : "s"}</p>
        </div>
        <Link href="/admin/requests" className="rounded-2xl bg-[#efe3f1] p-5 hover:ring-2 hover:ring-bloom">
          <p className="text-3xl font-bold">{summary.new_requests}</p>
          <p className="font-semibold">new custom request{summary.new_requests === 1 ? "" : "s"}</p>
        </Link>
      </section>

      {summary.low_stock.length > 0 && (
        <section aria-labelledby="low-stock" className="rounded-2xl border-2 border-bloom p-5">
          <h2 id="low-stock" className="mb-2 font-sans text-lg font-bold">Running low</h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {summary.low_stock.map((product) => (
              <li key={product.id}>
                <Link href={`/admin/products/${product.id}`} className="underline decoration-bloom-deep underline-offset-4">{product.title}</Link>: {product.stock} left
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="orders-heading" className="grid gap-4">
        <h1 id="orders-heading" className="text-3xl">Orders</h1>
        <form className="flex flex-wrap items-end gap-3" role="search">
          <label className="grid gap-1 text-sm font-semibold">
            Status
            <Select name="status" defaultValue={status} className="w-44">
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((value) => (
                <option key={value} value={value}>{value} ({summary.status_counts[value] ?? 0})</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Search
            <Input name="q" defaultValue={query} placeholder="#12, name, number or email" className="w-64" />
          </label>
          <Button type="submit" variant="secondary">Show orders</Button>
          {(status || query) && <Button asChild variant="link"><Link href="/admin">Clear</Link></Button>}
        </form>

        {orders.length === 0 ? (
          <p className="rounded-2xl bg-petal p-6">No orders match. {status || query ? "Try clearing the filters." : "New orders will appear here."}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl ring-2 ring-line">
            <table className="w-full min-w-[46rem] text-left text-[0.95rem]">
              <thead className="bg-paper text-sm">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Delivery and payment</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-line">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-bold underline decoration-bloom-deep underline-offset-4">#{order.id}</Link>
                      <p className="text-sm text-ink-soft">{formatDateTime(order.created_at)}</p>
                    </td>
                    <td className="px-4 py-3">
                      {order.recipient}
                      <p className="text-sm text-ink-soft">{order.contact}, account {order.buyer}</p>
                    </td>
                    <td className="px-4 py-3">
                      {order.fulfillment === "pickup" ? "Pickup" : "Delivery"}, {PAYMENT_LABEL[order.payment_method as PaymentMethod]}
                      {order.status === "Placed" && order.payment_method === "gcash" && (
                        <p className={order.has_receipt ? "text-sm font-semibold text-leaf" : "text-sm text-ink-soft"}>
                          {order.has_receipt ? "Receipt uploaded" : "No receipt yet"}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPeso(order.total_cents)}<p className="text-sm font-normal text-ink-soft">{order.item_count} pc</p></td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} fulfillment={order.fulfillment} admin /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center gap-3">
            {page > 1 && <Button asChild variant="secondary" size="sm"><Link href={pageLink(page - 1)}>Newer</Link></Button>}
            <span className="text-sm text-ink-soft">Page {page} of {pages}, {total} orders</span>
            {page < pages && <Button asChild variant="secondary" size="sm"><Link href={pageLink(page + 1)}>Older</Link></Button>}
          </nav>
        )}
      </section>

      <ExportOrders />
    </div>
  );
}

export default function AdminOrdersPage(props: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <AdminOrders {...props} />
    </Suspense>
  );
}
