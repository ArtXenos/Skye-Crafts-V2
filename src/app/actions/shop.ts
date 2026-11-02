"use server";

// Server Actions for customers. Each one validates its input, then calls the
// database, which checks everything again (see supabase/migrations). Anyone
// can call a Server Action directly, so nothing here trusts the browser.
import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { fromDatabaseError, failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { clientHash } from "@/lib/client-hash";
import { TAGS } from "@/lib/data/catalog";
import { sendOrderStatusEmail } from "@/lib/email";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkImage } from "@/lib/uploads";
import {
  checkoutRequestSchema,
  couponQuoteSchema,
  customRequestEditSchema,
  customRequestSchema,
  newsletterSchema,
  reviewSchema,
} from "@/lib/validation";

const LOGIN_FIRST = failure("Please log in first.", { kind: "auth" });

async function emailOrderUpdate(orderId: number) {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_email, status, fulfillment, total_cents, status_note")
    .eq("id", orderId)
    .maybeSingle();
  if (order) after(() => sendOrderStatusEmail(order));
}

// public forms --------------------------------------------------------------

export async function subscribeNewsletter(input: unknown): Promise<ActionResult> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await createServiceClient().rpc("subscribe_newsletter", {
    p_client_hash: await clientHash(),
    p_email: parsed.data.email,
  });
  if (error) return fromDatabaseError(error, "subscribe_newsletter");
  return success(null, "You're on the list. We'll email you about new pieces.");
}

export async function submitCustomRequest(input: unknown): Promise<ActionResult> {
  const parsed = customRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const user = await getCurrentUser();
  const { error } = await createServiceClient().rpc("submit_custom_request", {
    // Guests have no account. (The generated types don't know this argument may be null.)
    p_user_id: user?.id ?? (null as unknown as string),
    p_client_hash: await clientHash(),
    p_name: parsed.data.name,
    p_contact: parsed.data.contact,
    p_occasion: parsed.data.occasion,
    p_details: parsed.data.details,
  });
  if (error) return fromDatabaseError(error, "submit_custom_request");
  return success(
    null,
    user
      ? "Request sent. You'll see the shop's reply and quote under My orders."
      : "Request sent. The shop will reply to the contact details you gave.",
  );
}

export async function editCustomRequest(input: unknown): Promise<ActionResult> {
  const parsed = customRequestEditSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await getCurrentUser())) return LOGIN_FIRST;

  // The database checks it is the customer's own request and still open.
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_custom_request", {
    p_id: parsed.data.id,
    p_contact: parsed.data.contact,
    p_occasion: parsed.data.occasion,
    p_details: parsed.data.details,
  });
  if (error) return fromDatabaseError(error, "update_custom_request");
  refresh();
  return success(null, "Request updated. The shop will see your changes.");
}

// checkout ------------------------------------------------------------------

export type CouponQuote = { code: string; subtotal_cents: number; discount_cents: number; total_cents: number };

export async function quoteCoupon(input: unknown): Promise<ActionResult<CouponQuote>> {
  const parsed = couponQuoteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await getCurrentUser())) return LOGIN_FIRST;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_coupon", {
    p_code: parsed.data.code,
    p_items: parsed.data.items,
  });
  if (error) return fromDatabaseError(error, "quote_coupon");
  const quote = data as { ok: boolean; kind?: string; message?: string } & CouponQuote;
  if (!quote.ok) return failure(quote.message ?? "That coupon can't be used.", { kind: quote.kind });
  return success(
    { code: quote.code, subtotal_cents: quote.subtotal_cents, discount_cents: quote.discount_cents, total_cents: quote.total_cents },
  );
}

export async function placeOrder(input: unknown): Promise<ActionResult<{ orderId: number }>> {
  const parsed = checkoutRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await getCurrentUser())) return LOGIN_FIRST;

  const { form, items, checkoutKey } = parsed.data;
  const supabase = await createClient();

  // Free up stock held by unpaid orders that have run out of time. This is a
  // separate request (its own transaction) on purpose; see the migration.
  await supabase.rpc("expire_stale_orders");

  // Checkout only accepts a coupon checked with quote_coupon (which counts
  // attempts), so check it now even if the customer didn't press Apply.
  if (form.coupon_code.trim()) {
    const { data: quote, error: quoteError } = await supabase.rpc("quote_coupon", {
      p_code: form.coupon_code,
      p_items: items,
    });
    if (quoteError) return fromDatabaseError(quoteError, "quote_coupon");
    const checked = quote as { ok: boolean; message?: string; kind?: string };
    if (!checked.ok) {
      return failure("Check the highlighted fields.", { fieldErrors: { coupon_code: [checked.message ?? "That coupon can't be used."] }, kind: checked.kind });
    }
  }

  const { data: orderId, error } = await supabase.rpc("place_order", {
    p_items: items,
    p_recipient: form.recipient,
    p_contact: form.contact,
    p_fulfillment: form.fulfillment,
    p_address: form.fulfillment === "delivery" ? form.address : "",
    p_payment_method: form.payment_method,
    p_note: form.note,
    p_coupon_code: form.coupon_code,
    p_checkout_key: checkoutKey,
  });
  if (error) return fromDatabaseError(error, "place_order");

  updateTag(TAGS.products); // stock changed
  await emailOrderUpdate(orderId);
  return success({ orderId });
}

// after checkout ------------------------------------------------------------

const orderIdSchema = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

export async function cancelOrder(orderIdInput: unknown): Promise<ActionResult> {
  const orderId = orderIdSchema(orderIdInput);
  if (!orderId) return failure("Order not found.");
  if (!(await getCurrentUser())) return LOGIN_FIRST;

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error) return fromDatabaseError(error, "cancel_order");

  updateTag(TAGS.products); // stock returned
  await emailOrderUpdate(orderId);
  return success(null, "Order cancelled.");
}

export async function confirmReceipt(orderIdInput: unknown): Promise<ActionResult> {
  const orderId = orderIdSchema(orderIdInput);
  if (!orderId) return failure("Order not found.");
  if (!(await getCurrentUser())) return LOGIN_FIRST;

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_receipt", { p_order_id: orderId });
  if (error) return fromDatabaseError(error, "confirm_receipt");
  refresh();
  return success(null, "Thank you! Your order is marked as received.");
}

export async function uploadReceipt(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const orderId = orderIdSchema(Number(formData.get("orderId")));
  if (!orderId) return failure("Order not found.");
  const user = await getCurrentUser();
  if (!user) return LOGIN_FIRST;

  const image = await checkImage(formData.get("receipt"));
  if (typeof image === "string") return failure(image);

  // The database only accepts receipts inside the customer's own folder.
  const path = `${user.id}/order-${orderId}-${randomUUID().slice(0, 8)}.${image.ext}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, image.bytes, { contentType: image.type, upsert: false });
  if (uploadError) {
    console.error("[uploadReceipt] storage", uploadError);
    return failure("The receipt couldn't be uploaded. Please try again.");
  }

  const { error } = await supabase.rpc("attach_receipt", { p_order_id: orderId, p_path: path });
  if (error) return fromDatabaseError(error, "attach_receipt");
  refresh();
  return success(null, "Receipt received. The shop will confirm your order after checking it.");
}

// reviews -------------------------------------------------------------------

export async function submitReview(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await getCurrentUser())) return LOGIN_FIRST;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", {
    p_product_id: parsed.data.productId,
    p_rating: parsed.data.rating,
    p_body: parsed.data.body,
  });
  if (error) return fromDatabaseError(error, "submit_review");
  updateTag(TAGS.reviews);
  return success(null, "Thanks for your review!");
}
