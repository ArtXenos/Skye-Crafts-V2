// Shop vocabulary shared by the storefront and the admin pages. The database
// enforces the same lists with CHECK constraints (supabase/migrations).

export const SHOP_NAME = "Skye Crafts";

// Product categories. Each variety the shop sells (a purple bouquet, a
// sunflower pot, a hair clip) is its own product with its own name, photo,
// price and stock, filed under one of these. Adding varieties needs no code
// change; adding a *category* means changing this list and the database
// constraint together (see the latest migration that touches products).
export const CATEGORIES = ["Flower Bouquets", "Keychains", "Fuzzy Wire Pots", "Desk Figurines", "Accessories"] as const;
export type Category = (typeof CATEGORIES)[number];

/** For links and page anchors, e.g. /products#flower-bouquets. */
export const CATEGORY_SLUGS: Record<Category, string> = {
  "Flower Bouquets": "flower-bouquets",
  Keychains: "keychains",
  "Fuzzy Wire Pots": "fuzzy-wire-pots",
  "Desk Figurines": "desk-figurines",
  Accessories: "accessories",
};

/** What belongs in each category, shown on the shop and admin pages. */
export const CATEGORY_BLURBS: Record<Category, string> = {
  "Flower Bouquets": "Wrapped and ribboned bouquets of fuzzy-wire flowers.",
  Keychains: "Keychains of every kind, from mirror keychains to little charms.",
  "Fuzzy Wire Pots": "Small potted flowers for a desk or shelf.",
  "Desk Figurines": "Characters and shapes to sit on a desk.",
  Accessories: "Hair clips, bracelets and other little things to wear or carry.",
};

export function categorySlug(category: string) {
  return CATEGORY_SLUGS[category as Category] ?? "other";
}

export const ORDER_STATUSES = [
  "Placed", "Approved", "Packed", "Shipped", "Delivered", "Declined", "Cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENTS = ["delivery", "pickup"] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];

export const PAYMENT_METHODS = ["gcash", "cash_on_pickup"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  gcash: "GCash",
  cash_on_pickup: "Cash on pickup",
};

export const REQUEST_STATUSES = ["New", "Quoted", "In progress", "Completed", "Declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** How a status reads to the customer (pickup orders use different words). */
export function customerStatusLabel(status: string, fulfillment: string) {
  const pickup = fulfillment === "pickup";
  switch (status) {
    case "Placed": return "Waiting for the shop to confirm";
    case "Approved": return "Confirmed, being made";
    case "Packed": return "Packed";
    case "Shipped": return pickup ? "Ready for pickup" : "Out for delivery";
    case "Delivered": return pickup ? "Picked up" : "Delivered";
    case "Declined": return "Declined by the shop";
    case "Cancelled": return "Cancelled";
    default: return status;
  }
}

/** The next steps the shop owner can take, mirroring private.can_transition. */
export const ADMIN_NEXT_STEPS: Record<string, { status: OrderStatus; label: string; needsNote?: boolean }[]> = {
  Placed: [
    { status: "Approved", label: "Confirm order" },
    { status: "Declined", label: "Decline", needsNote: true },
  ],
  Approved: [
    { status: "Packed", label: "Mark packed" },
    { status: "Cancelled", label: "Cancel", needsNote: true },
  ],
  Packed: [
    { status: "Shipped", label: "Out for delivery / ready for pickup" },
    { status: "Cancelled", label: "Cancel", needsNote: true },
  ],
  Shipped: [{ status: "Delivered", label: "Mark delivered" }],
};

/** Statuses in which the customer may still cancel. */
export const CUSTOMER_CANCELLABLE = new Set<string>(["Placed", "Approved"]);

export const MAX_QUANTITY = 99;
