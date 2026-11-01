import { describe, expect, it } from "vitest";
import { checkoutSchema, couponSchema, exportSchema, productSchema, registerSchema, settingsSchema } from "./validation";

const checkout = {
  recipient: "Maria Santos",
  contact: "0917 123 4567",
  fulfillment: "delivery",
  address: "123 Rizal Street, Davao City",
  payment_method: "gcash",
  note: "",
  coupon_code: "",
} as const;

describe("checkoutSchema", () => {
  it("accepts a normal delivery order", () => {
    expect(checkoutSchema.safeParse(checkout).success).toBe(true);
  });

  it("needs an address for delivery but not for pickup", () => {
    expect(checkoutSchema.safeParse({ ...checkout, address: "" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...checkout, fulfillment: "pickup", address: "" }).success).toBe(true);
  });

  it("allows cash on pickup only for pickup", () => {
    expect(checkoutSchema.safeParse({ ...checkout, payment_method: "cash_on_pickup" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...checkout, fulfillment: "pickup", payment_method: "cash_on_pickup" }).success).toBe(true);
  });

  it("rejects letters in the mobile number", () => {
    expect(checkoutSchema.safeParse({ ...checkout, contact: "call me" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("normalises the email and checks the username", () => {
    const parsed = registerSchema.parse({ email: " Maria@Example.COM ", username: "maria_s", password: "long-enough-pw" });
    expect(parsed.email).toBe("maria@example.com");
    expect(registerSchema.safeParse({ email: "m@e.co", username: "no spaces", password: "long-enough-pw" }).success).toBe(false);
  });
});

describe("productSchema", () => {
  it("converts the price to centavos", () => {
    const parsed = productSchema.parse({
      title: "Tulip", description: "A tulip.", category: "Bouquets",
      price: "1,250.50", stock: "3", is_preorder: false, is_active: true,
    });
    expect(parsed).toMatchObject({ price: 125050, stock: 3 });
  });
});

describe("couponSchema", () => {
  const coupon = {
    code: "welcome10", discount_type: "percentage", discount_value: "10",
    max_discount: "100", min_order: "", max_uses: "0", once_per_customer: true,
    starts_on: "2026-11-01", ends_on: "2026-11-30", is_active: true,
  } as const;

  it("upper-cases the code and converts pesos", () => {
    expect(couponSchema.parse(coupon)).toMatchObject({
      code: "WELCOME10", discount_value: 10, max_discount_cents: 10000, min_order_cents: 0,
    });
  });

  it("reads a fixed discount as pesos and ignores the percentage cap", () => {
    expect(couponSchema.parse({ ...coupon, discount_type: "fixed", discount_value: "50" }))
      .toMatchObject({ discount_value: 5000, max_discount_cents: 0 });
  });

  it.each([
    ["a percentage over 100", { discount_value: "150" }],
    ["an impossible date", { starts_on: "2026-02-30" }],
    ["an end before the start", { ends_on: "2026-10-01" }],
    ["a fixed discount over ₱100,000", { discount_type: "fixed", discount_value: "100000.01" }],
    ["a minimum order over ₱1,000,000", { min_order: "1000000.01" }],
  ])("rejects %s", (_label, change) => {
    expect(couponSchema.safeParse({ ...coupon, ...change }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  it("only accepts https links", () => {
    const base = Object.fromEntries(Object.keys(settingsSchema.shape).map((key) => [key, ""]));
    const valid = { ...base, unpaid_order_hours: "48", low_stock_threshold: "3" };
    expect(settingsSchema.safeParse({ ...valid, facebook_url: "https://facebook.com/skye" }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...valid, facebook_url: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, unpaid_order_hours: "0" }).success).toBe(false);
  });

  it("stores the map pin as lat,lng, or nothing", () => {
    const base = Object.fromEntries(Object.keys(settingsSchema.shape).map((key) => [key, ""]));
    const valid = { ...base, unpaid_order_hours: "48", low_stock_threshold: "3" };
    const pin = (value: string) => settingsSchema.safeParse({ ...valid, pickup_coordinates: value });
    expect(pin("").data?.pickup_coordinates).toBe("");
    expect(pin(" 7.0731, 125.6128 ").data?.pickup_coordinates).toBe("7.073100,125.612800");
    expect(pin("https://www.google.com/maps/@7.0731,125.6128,17z").data?.pickup_coordinates).toBe("7.073100,125.612800");
    expect(pin("125.6128, 7.0731").success).toBe(false);
    expect(pin("Davao City").success).toBe(false);
  });
});

describe("exportSchema", () => {
  it("defaults to sales, one row per order", () => {
    expect(exportSchema.parse({ from: "2026-10-01", to: "2026-10-31" })).toEqual({ from: "2026-10-01", to: "2026-10-31", scope: "sales", kind: "orders" });
  });
  it.each([
    [{ from: "2026-10-31", to: "2026-10-01" }],
    [{ from: "2026-02-30", to: "2026-03-01" }],
    [{ from: "yesterday", to: "2026-03-01" }],
    [{ from: "2026-10-01", to: "2026-10-31", scope: "everything" }],
    [{ from: "2026-10-01", to: "2026-10-31", kind: "pdf" }],
  ])("rejects %o", (input) => {
    expect(exportSchema.safeParse(input).success).toBe(false);
  });
});
