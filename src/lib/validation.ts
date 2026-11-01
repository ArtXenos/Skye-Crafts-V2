// Form rules, shared by the browser (instant feedback) and Server Actions
// (which re-check everything, because anyone can call an action directly).
// The database checks the same rules a third time; these exist to give
// friendly messages before a request is made.
import { z } from "zod";
import { formatCoordinates, parseCoordinates } from "@/lib/geo";
import { pesoToCents } from "@/lib/money";
import { CATEGORIES, FULFILLMENTS, ORDER_STATUSES, PAYMENT_METHODS, REQUEST_STATUSES } from "@/lib/shop";

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `Enter ${label}.` : `${capitalize(label)} needs at least ${min} characters.`)
    .max(max, `${capitalize(label)} can be at most ${max} characters.`);

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${capitalize(label)} can be at most ${max} characters.`);

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const email = z.string().trim().toLowerCase().max(254, "That email address is too long.").pipe(z.email("Enter a valid email address."));

const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.");

/** A peso amount typed into a form, converted to centavos. */
const pesos = (label: string, { min = 1, max = 10_000_000 } = {}) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const cents = pesoToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in pesos, like 450 or 450.50.` });
        return z.NEVER;
      }
      if (cents < min || cents > max) {
        ctx.addIssue({ code: "custom", message: `${capitalize(label)} must be between ₱${min / 100} and ₱${(max / 100).toLocaleString("en-PH")}.` });
        return z.NEVER;
      }
      return cents;
    });

const optionalPesos = (label: string, max = 10_000_000) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return 0;
      const cents = pesoToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in pesos, or leave it empty.` });
        return z.NEVER;
      }
      if (cents > max) {
        ctx.addIssue({ code: "custom", message: `${capitalize(label)} can be at most ₱${(max / 100).toLocaleString("en-PH")}.` });
        return z.NEVER;
      }
      return cents;
    });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "That date doesn't exist.");

// accounts ------------------------------------------------------------------

export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,30}$/, "Use 3-30 letters, numbers or underscores.");

export const registerSchema = z.object({
  email,
  username: usernameSchema,
  password,
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    message: "The two passwords don't match.",
    path: ["confirm"],
  });

// shopping ------------------------------------------------------------------

export const cartItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z
  .object({
    recipient: text(2, 80, "the recipient's name"),
    contact: z
      .string()
      .trim()
      .regex(/^[0-9+() -]{7,40}$/, "Enter a mobile number (digits, spaces, + or -)."),
    fulfillment: z.enum(FULFILLMENTS, "Choose delivery or pickup."),
    address: optionalText(500, "the address"),
    payment_method: z.enum(PAYMENT_METHODS, "Choose how you will pay."),
    note: optionalText(300, "the note"),
    coupon_code: optionalText(40, "the coupon code"),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillment === "delivery" && value.address.length < 10) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Enter the full delivery address (at least 10 characters)." });
    }
    if (value.payment_method === "cash_on_pickup" && value.fulfillment !== "pickup") {
      ctx.addIssue({ code: "custom", path: ["payment_method"], message: "Cash on pickup is only for pickup orders." });
    }
  });
export type CheckoutInput = z.input<typeof checkoutSchema>;

export const checkoutRequestSchema = z.object({
  form: checkoutSchema,
  items: z.array(cartItemSchema).min(1, "Your cart is empty.").max(50),
  checkoutKey: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
});

export const couponQuoteSchema = z.object({
  code: z.string().trim().min(1, "Enter a coupon code.").max(40),
  items: z.array(cartItemSchema).min(1, "Your cart is empty.").max(50),
});

export const reviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1, "Choose a star rating.").max(5),
  body: optionalText(1000, "the review"),
});
export type ReviewInput = z.input<typeof reviewSchema>;

export const customRequestSchema = z.object({
  name: text(2, 80, "your name"),
  contact: text(5, 120, "an email address or mobile number"),
  occasion: optionalText(100, "the occasion"),
  details: text(10, 2000, "your idea"),
});
export type CustomRequestInput = z.input<typeof customRequestSchema>;

export const newsletterSchema = z.object({ email });

// admin ---------------------------------------------------------------------

export const productSchema = z.object({
  title: text(3, 100, "the name"),
  description: text(1, 1000, "a description"),
  category: z.enum(CATEGORIES, "Choose a category."),
  price: pesos("the price"),
  stock: z.coerce.number<string | number>().int("Stock must be a whole number.").min(0).max(100000),
  is_preorder: z.boolean(),
  is_active: z.boolean(),
});
export type ProductInput = z.input<typeof productSchema>;

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, "Use 3-40 letters, numbers, - or _."),
    discount_type: z.enum(["percentage", "fixed"]),
    discount_value: z.string().trim(),
    max_discount: optionalPesos("the maximum discount"),
    min_order: optionalPesos("the minimum order", 100_000_000),
    max_uses: z.coerce.number<string | number>().int().min(0, "Use 0 for unlimited.").max(1_000_000),
    once_per_customer: z.boolean(),
    starts_on: isoDate,
    ends_on: isoDate,
    is_active: z.boolean(),
  })
  .transform((value, ctx) => {
    let discount = 0;
    if (value.discount_type === "percentage") {
      discount = Number(value.discount_value);
      if (!Number.isInteger(discount) || discount < 1 || discount > 100) {
        ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Enter a whole percentage from 1 to 100." });
        return z.NEVER;
      }
    } else {
      const cents = pesoToCents(value.discount_value);
      if (cents === null || cents < 1 || cents > 10_000_000) {
        ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Enter the discount in pesos, like 50 (at most ₱100,000)." });
        return z.NEVER;
      }
      discount = cents;
    }
    if (value.ends_on < value.starts_on) {
      ctx.addIssue({ code: "custom", path: ["ends_on"], message: "The end date must be on or after the start date." });
      return z.NEVER;
    }
    return {
      code: value.code,
      discount_type: value.discount_type,
      discount_value: discount,
      max_discount_cents: value.discount_type === "percentage" ? value.max_discount : 0,
      min_order_cents: value.min_order,
      max_uses: value.max_uses,
      once_per_customer: value.once_per_customer,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      is_active: value.is_active,
    };
  });
export type CouponInput = z.input<typeof couponSchema>;

export const orderStatusSchema = z.object({
  orderId: z.number().int().positive(),
  status: z.enum(ORDER_STATUSES),
  note: optionalText(300, "the note"),
});

export const requestUpdateSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(REQUEST_STATUSES),
  quote: optionalPesos("the quote"),
  shop_note: optionalText(1000, "the note"),
});
export type RequestUpdateInput = z.input<typeof requestUpdateSchema>;

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || /^https:\/\/[^\s<>"]+$/.test(value), "Use a full https:// link, or leave it empty.");

// The owner pastes coordinates or a map link; it's stored as "lat,lng".
const pickupCoordinates = z
  .string()
  .trim()
  .max(2000, "That link is too long. Paste just the two numbers, for example 7.0731, 125.6128.")
  .transform((value, ctx) => {
    if (value === "") return "";
    const point = parseCoordinates(value);
    if (point) return formatCoordinates(point);
    ctx.addIssue({
      code: "custom",
      message: "Paste the two numbers from Google Maps (latitude first, for example 7.0731, 125.6128), or tap the map.",
    });
    return z.NEVER;
  });

export const settingsSchema = z.object({
  public_area: optionalText(120, "the area"),
  pickup_location: optionalText(1000, "the pickup location"),
  pickup_coordinates: pickupCoordinates,
  pickup_schedule: optionalText(1000, "the pickup schedule"),
  gcash_name: optionalText(80, "the GCash name"),
  gcash_number: optionalText(30, "the GCash number"),
  shipping_note: optionalText(400, "the shipping note"),
  lead_time_ready: optionalText(120, "the lead time"),
  lead_time_custom: optionalText(120, "the lead time"),
  cancellation_note: optionalText(400, "the cancellation note"),
  damaged_note: optionalText(400, "the damaged-item note"),
  refund_note: optionalText(400, "the refund note"),
  unpaid_order_hours: z
    .string()
    .trim()
    .regex(/^([1-9][0-9]?|1[0-5][0-9]|16[0-8])$/, "Use a whole number of hours from 1 to 168."),
  low_stock_threshold: z.string().trim().regex(/^[0-9]{1,4}$/, "Use a whole number."),
  contact_phone: optionalText(30, "the phone number"),
  facebook_url: httpsUrl,
  tiktok_url: httpsUrl,
});
export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingKey = keyof SettingsInput;

/** Turn a ZodError into {field: [messages]} for forms. */
export function fieldErrors(error: z.ZodError) {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

// Admin CSV export (GET /admin/orders/export) --------------------------------

export const EXPORT_SCOPES = ["sales", "all", ...ORDER_STATUSES] as const;

export const exportSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    // "sales": every order except declined and cancelled ones.
    scope: z.enum(EXPORT_SCOPES).default("sales"),
    // "orders": one row per order. "items": one row per piece sold.
    kind: z.enum(["orders", "items"]).default("orders"),
  })
  .refine((value) => value.from <= value.to, { message: "The start date must be on or before the end date.", path: ["to"] });
export type ExportInput = z.output<typeof exportSchema>;
