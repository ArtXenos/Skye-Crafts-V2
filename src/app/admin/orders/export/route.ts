// GET /admin/orders/export?from=2026-10-01&to=2026-10-31&scope=sales&kind=orders
//
// Downloads orders as a CSV file for Excel or Google Sheets. Route Handlers
// don't go through the admin layout, so this checks for the owner itself;
// the database's row-level security would also return nothing to anyone else.
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { pesos, toCsv, type CsvValue } from "@/lib/csv";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { exportSchema } from "@/lib/validation";

const PAGE = 1000; // Supabase returns at most 1,000 rows per request
const MAX_ORDERS = 20_000; // a safety stop, far beyond a small shop's needs

type Row = {
  id: number;
  created_at: string;
  status: string;
  recipient: string;
  contact: string;
  buyer_email: string;
  fulfillment: string;
  address: string;
  payment_method: string;
  note: string;
  coupon_code: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  receipt_path: string | null;
  order_items: { title: string; price_cents: number; quantity: number; is_preorder: boolean }[];
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Only the shop owner can export orders.", { status: 403 });

  const parsed = exportSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return new Response(parsed.error.issues[0]?.message ?? "Check the dates.", { status: 400 });
  }
  const { from, to, scope, kind } = parsed.data;

  // The shop works in Manila time: "from" starts at midnight there, and "to"
  // includes that whole day.
  const start = new Date(`${from}T00:00:00+08:00`).toISOString();
  const end = new Date(Date.parse(`${to}T00:00:00+08:00`) + 24 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const orders: Row[] = [];
  for (let offset = 0; offset < MAX_ORDERS; offset += PAGE) {
    let query = supabase
      .from("orders")
      .select(
        "id, created_at, status, recipient, contact, buyer_email, fulfillment, address, payment_method, note, coupon_code, " +
          "subtotal_cents, discount_cents, total_cents, receipt_path, order_items (title, price_cents, quantity, is_preorder)",
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id")
      .order("id", { referencedTable: "order_items" })
      .range(offset, offset + PAGE - 1);
    if (scope === "sales") query = query.not("status", "in", "(Declined,Cancelled)");
    else if (scope !== "all") query = query.eq("status", scope);

    const { data, error } = await query.returns<Row[]>();
    if (error) {
      console.error("[orders export]", error);
      return new Response("The export failed. Please try again.", { status: 500 });
    }
    orders.push(...data);
    if (data.length < PAGE) break;
  }

  const csv = kind === "items" ? itemsCsv(orders) : ordersCsv(orders);
  const filename = `skye-crafts-${kind}-${from}-to-${to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Customer details: never keep a copy in a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}

/** Date and time in Manila, in a form spreadsheets recognise: 2026-11-01 14:05 */
function manilaTime(iso: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function ordersCsv(orders: Row[]) {
  const header = [
    "Order", "Date (Manila)", "Status", "Customer", "Contact", "Email", "Fulfillment", "Address",
    "Payment", "Receipt uploaded", "Pieces", "Items", "Subtotal (PHP)", "Discount (PHP)", "Coupon", "Total (PHP)", "Note",
  ];
  const rows: CsvValue[][] = orders.map((order) => [
    order.id,
    manilaTime(order.created_at),
    order.status,
    order.recipient,
    order.contact,
    order.buyer_email,
    order.fulfillment === "pickup" ? "Pickup" : "Delivery",
    order.address,
    PAYMENT_LABEL[order.payment_method as PaymentMethod] ?? order.payment_method,
    order.receipt_path ? "Yes" : "No",
    order.order_items.reduce((sum, item) => sum + item.quantity, 0),
    order.order_items.map((item) => `${item.quantity} x ${item.title}`).join("; "),
    pesos(order.subtotal_cents),
    pesos(order.discount_cents),
    order.coupon_code,
    pesos(order.total_cents),
    order.note,
  ]);
  return toCsv(header, rows);
}

/** One row per piece: good for "what sells best" with a pivot table. */
function itemsCsv(orders: Row[]) {
  const header = ["Order", "Date (Manila)", "Status", "Product", "Made to order", "Quantity", "Unit price (PHP)", "Line total (PHP)"];
  const rows: CsvValue[][] = orders.flatMap((order) =>
    order.order_items.map((item) => [
      order.id,
      manilaTime(order.created_at),
      order.status,
      item.title,
      item.is_preorder ? "Yes" : "No",
      item.quantity,
      pesos(item.price_cents),
      pesos(item.price_cents * item.quantity),
    ]),
  );
  return toCsv(header, rows);
}
