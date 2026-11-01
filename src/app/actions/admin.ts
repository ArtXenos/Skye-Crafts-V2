"use server";

// Server Actions for the shop owner. Each checks for an admin first (so a
// customer gets a clear "no"), and the database checks again (is_admin() in
// every policy and admin function), so a missed check here can't leak data.
import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { failure, fromDatabaseError, invalid, success, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { TAGS } from "@/lib/data/catalog";
import { sendOrderStatusEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { checkImage, type CheckedImage } from "@/lib/uploads";
import { couponSchema, orderStatusSchema, productSchema, requestUpdateSchema, settingsSchema, type SettingKey } from "@/lib/validation";

async function adminClient() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;
  return createClient();
}

const NOT_ADMIN = failure("Shop admin access is required.", { kind: "forbidden" });

function positiveId(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

// orders --------------------------------------------------------------------

export async function setOrderStatus(input: unknown): Promise<ActionResult> {
  const parsed = orderStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const { orderId, status, note } = parsed.data;
  const { error } = await supabase.rpc("admin_set_order_status", { p_order_id: orderId, p_status: status, p_note: note });
  if (error) return fromDatabaseError(error, "admin_set_order_status");

  if (status === "Declined" || status === "Cancelled") updateTag(TAGS.products); // stock returned
  const { data: order } = await supabase
    .from("orders")
    .select("id, buyer_email, status, fulfillment, total_cents, status_note")
    .eq("id", orderId)
    .maybeSingle();
  if (order) after(() => sendOrderStatusEmail(order));
  refresh();
  return success(null, `Order #${orderId} is now ${status.toLowerCase()}.`);
}

// products ------------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Put a checked photo in storage and point the product at it. Returns an error message, or null. */
async function storeProductPhoto(supabase: Supabase, productId: number, image: CheckedImage) {
  const path = `${productId}/${randomUUID().slice(0, 12)}.${image.ext}`;
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, image.bytes, { contentType: image.type, cacheControl: "31536000", upsert: false });
  if (uploadError) {
    console.error("[product photo]", uploadError);
    return "The photo couldn't be uploaded. Please try again.";
  }
  const { error } = await supabase.from("products").update({ image_path: path }).eq("id", productId);
  if (error) {
    console.error("[product photo]", error);
    await supabase.storage.from("product-images").remove([path]);
    return "The photo couldn't be saved. Please try again.";
  }
  return null;
}

/**
 * Add a product together with its photo. Every product needs a real photo,
 * so if the photo can't be stored, the new product is removed again rather
 * than left in the shop without one.
 */
export async function createProduct(input: unknown, photo: FormData): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const image = await checkImage(photo instanceof FormData ? photo.get("image") : null);
  if (typeof image === "string") {
    const message = image === "Choose a photo to upload." ? "Add a photo of the piece." : image;
    return failure(message, { fieldErrors: { image: [message] } });
  }

  const { price, stock, ...rest } = parsed.data;
  const { data, error } = await supabase
    .from("products")
    .insert({ ...rest, stock, price_cents: price })
    .select("id")
    .single();
  if (error) return fromDatabaseError(error, "createProduct");

  const problem = await storeProductPhoto(supabase, data.id, image);
  if (problem) {
    await supabase.from("products").delete().eq("id", data.id);
    return failure(problem, { fieldErrors: { image: [problem] } });
  }

  updateTag(TAGS.products);
  redirect(`/admin/products/${data.id}?created=1`);
}

export async function saveProduct(
  productId: unknown,
  input: unknown,
  options: { stockChanged?: unknown; loadedAt?: unknown } = {},
): Promise<ActionResult<{ id: number }>> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const { price, stock, ...rest } = parsed.data;
  const id = positiveId(productId);
  if (!id) return failure("Product not found.");

  // Orders change stock all the time. Saving a stale number would undo
  // sales, so stock is written only when the owner edited it, and only if
  // the product hasn't changed since the form was opened.
  const stockChanged = options.stockChanged === true;
  let query = supabase
    .from("products")
    .update(stockChanged ? { ...rest, stock, price_cents: price } : { ...rest, price_cents: price })
    .eq("id", id);
  if (stockChanged) {
    if (typeof options.loadedAt !== "string") return failure("Reload the page, then try again.");
    query = query.eq("updated_at", options.loadedAt);
  }
  const { data, error } = await query.select("id");
  if (error) return fromDatabaseError(error, "saveProduct");
  if (data.length === 0) {
    return failure(
      stockChanged
        ? "This product changed since you opened it (an order may have come in). Reload the page, check the stock, then save again."
        : "Product not found.",
    );
  }

  updateTag(TAGS.products);
  refresh();
  return success({ id }, "Product saved.");
}

export async function uploadProductImage(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const productId = positiveId(Number(formData.get("productId")));
  if (!productId) return failure("Product not found.");
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const image = await checkImage(formData.get("image"));
  if (typeof image === "string") return failure(image);

  const { data: product } = await supabase.from("products").select("image_path").eq("id", productId).maybeSingle();
  if (!product) return failure("Product not found.");

  const problem = await storeProductPhoto(supabase, productId, image);
  if (problem) return failure(problem);
  if (product.image_path) await supabase.storage.from("product-images").remove([product.image_path]);

  updateTag(TAGS.products);
  refresh();
  return success(null, "Photo updated.");
}

export async function removeProductImage(productIdInput: unknown): Promise<ActionResult> {
  const productId = positiveId(productIdInput);
  if (!productId) return failure("Product not found.");
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const { data: product } = await supabase.from("products").select("image_path").eq("id", productId).maybeSingle();
  if (!product?.image_path) return success(null);
  const { error } = await supabase.from("products").update({ image_path: null }).eq("id", productId);
  if (error) return fromDatabaseError(error, "removeProductImage");
  await supabase.storage.from("product-images").remove([product.image_path]);

  updateTag(TAGS.products);
  refresh();
  return success(null, "Photo removed.");
}

export async function deleteProduct(productIdInput: unknown): Promise<ActionResult> {
  const productId = positiveId(productIdInput);
  if (!productId) return failure("Product not found.");
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const { data: product, error } = await supabase.from("products").delete().eq("id", productId).select("image_path").maybeSingle();
  if (error) return fromDatabaseError(error, "deleteProduct");
  if (product?.image_path) await supabase.storage.from("product-images").remove([product.image_path]);

  updateTag(TAGS.products);
  updateTag(TAGS.reviews);
  redirect("/admin/products?deleted=1");
}

// coupons -------------------------------------------------------------------

export async function saveCoupon(couponId: unknown, input: unknown): Promise<ActionResult> {
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const id = positiveId(couponId);
  const { error } = id
    ? await supabase.from("coupons").update(parsed.data).eq("id", id)
    : await supabase.from("coupons").insert(parsed.data);
  if (error?.code === "23505") {
    return failure("Check the highlighted fields.", { fieldErrors: { code: ["Another coupon already uses this code."] } });
  }
  if (error) return fromDatabaseError(error, "saveCoupon");
  redirect("/admin/coupons?saved=1");
}

export async function deleteCoupon(couponIdInput: unknown): Promise<ActionResult> {
  const id = positiveId(couponIdInput);
  if (!id) return failure("Coupon not found.");
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  // Orders keep the code they used (orders.coupon_code); the link is cleared.
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) return fromDatabaseError(error, "deleteCoupon");
  redirect("/admin/coupons?deleted=1");
}

// custom requests, reviews, subscribers ------------------------------------

export async function updateCustomRequest(input: unknown): Promise<ActionResult> {
  const parsed = requestUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const { id, status, quote, shop_note } = parsed.data;
  const { error } = await supabase
    .from("custom_requests")
    .update({ status, quote_cents: quote > 0 ? quote : null, shop_note })
    .eq("id", id);
  if (error) return fromDatabaseError(error, "updateCustomRequest");
  refresh();
  return success(null, "Request updated.");
}

export async function deleteReview(reviewIdInput: unknown): Promise<ActionResult> {
  const id = positiveId(reviewIdInput);
  if (!id) return failure("Review not found.");
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) return fromDatabaseError(error, "deleteReview");
  updateTag(TAGS.reviews);
  return success(null, "Review removed.");
}

export async function removeSubscriber(subscriberIdInput: unknown): Promise<ActionResult> {
  const id = positiveId(subscriberIdInput);
  if (!id) return failure("Subscriber not found.");
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
  if (error) return fromDatabaseError(error, "removeSubscriber");
  refresh();
  return success(null, "Subscriber removed.");
}

// settings ------------------------------------------------------------------

export async function saveSettings(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await adminClient();
  if (!supabase) return NOT_ADMIN;

  const results = await Promise.all(
    (Object.entries(parsed.data) as [SettingKey, string][]).map(([key, value]) =>
      supabase.from("shop_settings").update({ value }).eq("key", key),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) return fromDatabaseError(failed.error, "saveSettings");

  updateTag(TAGS.settings);
  return success(null, "Settings saved.");
}
