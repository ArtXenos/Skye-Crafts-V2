// Shop vocabulary shared by the storefront and the admin pages. The database
// enforces the same lists with CHECK constraints (supabase/migrations).

export const SHOP_NAME = "Skye Crafts";

export const CATEGORIES = ["Bouquets", "Keychains", "Pots", "Figurines"] as const;
export type Category = (typeof CATEGORIES)[number];

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
    case "Shipped": return pickup ? "Ready for pickup" : "Shipped via J&T Express";
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
    { status: "Shipped", label: "Mark shipped / ready" },
    { status: "Cancelled", label: "Cancel", needsNote: true },
  ],
  Shipped: [{ status: "Delivered", label: "Mark delivered" }],
};

/** Statuses in which the customer may still cancel. */
export const CUSTOMER_CANCELLABLE = new Set<string>(["Placed", "Approved"]);

export const MAX_QUANTITY = 99;
