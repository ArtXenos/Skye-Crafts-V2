import "server-only";

import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The logged-in customer's own data. Never cached across people: these run
// per request with the customer's login, and Row Level Security limits every
// query to their own rows.

export async function getMyOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, fulfillment, payment_method, total_cents, created_at, receipt_path, order_items(quantity)")
    .order("id", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load orders: ${error.message}`);
  return data;
}

export async function getMyOrder(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`id, status, status_note, fulfillment, payment_method, recipient, contact, address, note,
      subtotal_cents, discount_cents, total_cents, coupon_code, receipt_path, expires_at, created_at,
      order_items(id, product_id, title, price_cents, quantity, is_preorder),
      order_events(id, status, note, actor, created_at)`)
    .eq("id", id)
    .order("id", { referencedTable: "order_items" })
    .order("id", { referencedTable: "order_events" })
    .maybeSingle();
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return data;
}

/** GCash details and the pickup place, shown only at the step they're needed. */
export async function getOrderPrivateDetails(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("order_private_details", { p_order_id: id });
  if (error) return {};
  return (data ?? {}) as Partial<Record<"gcash_name" | "gcash_number" | "pickup_location" | "pickup_schedule" | "pickup_coordinates", string>>;
}

export async function getMyCustomRequests() {
  await connection(); // getClaims() reads Date.now(); see getCurrentUser
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data, error } = await supabase
    .from("custom_requests")
    .select("id, occasion, details, status, quote_cents, shop_note, created_at")
    .eq("user_id", claims?.claims.sub ?? "")
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load requests: ${error.message}`);
  return data;
}
