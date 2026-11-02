// place_order: prices, stock, validation, retries and per-customer limits.
import { beforeAll, describe, expect, it } from "vitest";
import { appError, placeOrder, stockOf, setupTestDb, type Actor } from "./helpers";

const db = setupTestDb();
let buyer: Actor & { id: string };

beforeAll(async () => {
  buyer = await db.createUser("buyer");
});

describe("pricing and stock", () => {
  it("prices the order from the database and reduces stock", async () => {
    const before = await stockOf(db, 1);
    const id = await placeOrder(db, buyer, { items: [{ product_id: 1, quantity: 2 }, { product_id: 2, quantity: 1 }] });
    const [order] = await db.sql<Record<string, unknown>>("select * from public.orders where id = $1", [id]);
    expect(order).toMatchObject({ subtotal_cents: 45000 * 2 + 15000, discount_cents: 0, total_cents: 105000, status: "Placed" });
    expect(order.expires_at).not.toBeNull();
    expect(await stockOf(db, 1)).toBe(before - 2);

    const items = await db.sql("select product_id, title, price_cents, quantity from public.order_items where order_id = $1 order by product_id", [id]);
    expect(items).toEqual([
      { product_id: "1", title: "Fuzzy Wire Bouquet", price_cents: 45000, quantity: 2 },
      { product_id: "2", title: "Mirror Keychain", price_cents: 15000, quantity: 1 },
    ]);
    const events = await db.sql("select status, actor from public.order_events where order_id = $1", [id]);
    expect(events).toEqual([{ status: "Placed", actor: "customer" }]);
  });

  it("merges duplicate cart lines", async () => {
    const id = await placeOrder(db, buyer, { items: [{ product_id: 3, quantity: 1 }, { product_id: 3, quantity: 2 }] });
    const items = await db.sql("select quantity from public.order_items where order_id = $1", [id]);
    expect(items).toEqual([{ quantity: 3 }]);
    await db.sql("update public.orders set status = 'Cancelled' where buyer_id = $1", [buyer.id]);
  });

  it("does not take stock for pre-order items", async () => {
    const before = await stockOf(db, 4);
    await placeOrder(db, buyer, { items: [{ product_id: 4, quantity: 5 }] });
    expect(await stockOf(db, 4)).toBe(before);
    await db.sql("update public.orders set status = 'Cancelled' where buyer_id = $1", [buyer.id]);
  });

  it("refuses more than is in stock", async () => {
    await db.sql("update public.products set stock = 2 where id = 3");
    await expect(placeOrder(db, buyer, { items: [{ product_id: 3, quantity: 3 }] }))
      .rejects.toEqual(appError("conflict", "Only 2 left of Fuzzy Wire Pot."));
    await db.sql("update public.products set stock = 0 where id = 3");
    await expect(placeOrder(db, buyer, { items: [{ product_id: 3, quantity: 1 }] }))
      .rejects.toEqual(appError("conflict", "Fuzzy Wire Pot is sold out."));
    await db.sql("update public.products set stock = 12 where id = 3");
  });

  it("refuses hidden or missing products", async () => {
    await db.sql("update public.products set is_active = false where id = 2");
    await expect(placeOrder(db, buyer, { items: [{ product_id: 2, quantity: 1 }] })).rejects.toEqual(appError("conflict"));
    await db.sql("update public.products set is_active = true where id = 2");
    await expect(placeOrder(db, buyer, { items: [{ product_id: 999, quantity: 1 }] })).rejects.toEqual(appError("conflict"));
  });
});

describe("validation", () => {
  const bad: Array<[string, Parameters<typeof placeOrder>[2]]> = [
    ["an empty cart", { items: [] }],
    ["a cart that is not a list", { items: { product_id: 1 } }],
    ["a quantity of zero", { items: [{ product_id: 1, quantity: 0 }] }],
    ["a fractional quantity", { items: [{ product_id: 1, quantity: 1.5 }] }],
    ["a quantity sent as text", { items: [{ product_id: 1, quantity: "1" }] }],
    ["a negative product id", { items: [{ product_id: -1, quantity: 1 }] }],
    ["more than 99 of one product", { items: [{ product_id: 1, quantity: 60 }, { product_id: 1, quantity: 60 }] }],
    ["a one-letter recipient", { recipient: "A" }],
    ["letters in the mobile number", { contact: "call me maybe" }],
    ["an unknown fulfillment", { fulfillment: "drone" }],
    ["delivery without an address", { address: "short" }],
    ["an unknown payment method", { payment: "card" }],
    ["cash on pickup for a delivery", { payment: "cash_on_pickup" }],
    ["a note over 300 characters", { note: "x".repeat(301) }],
    ["a malformed checkout key", { key: "not valid!" }],
  ];

  it.each(bad)("rejects %s", async (_label, input) => {
    await expect(placeOrder(db, buyer, input)).rejects.toEqual(appError("invalid"));
  });

  it("accepts cash on pickup for a pickup order and drops any address", async () => {
    const id = await placeOrder(db, buyer, { fulfillment: "pickup", payment: "cash_on_pickup", address: "ignored street address" });
    const [order] = await db.sql("select address, payment_method from public.orders where id = $1", [id]);
    expect(order).toEqual({ address: "", payment_method: "cash_on_pickup" });
    await db.sql("update public.orders set status = 'Cancelled' where buyer_id = $1", [buyer.id]);
  });
});

describe("retries", () => {
  it("returns the same order when a checkout is retried", async () => {
    const key = "retry-key-0000000001";
    const before = await stockOf(db, 1);
    const first = await placeOrder(db, buyer, { key });
    const second = await placeOrder(db, buyer, { key });
    expect(second).toBe(first);
    expect(await stockOf(db, 1)).toBe(before - 1);
  });

  it("refuses to reuse a key for a different cart", async () => {
    const key = "retry-key-0000000002";
    await placeOrder(db, buyer, { key });
    await expect(placeOrder(db, buyer, { key, items: [{ product_id: 2, quantity: 1 }] })).rejects.toEqual(appError("conflict"));
    await db.sql("update public.orders set status = 'Cancelled' where buyer_id = $1", [buyer.id]);
  });

  it("scopes keys to the customer", async () => {
    const other = await db.createUser("other");
    const key = "shared-key-000000001";
    const mine = await placeOrder(db, buyer, { key });
    const theirs = await placeOrder(db, other, { key });
    expect(theirs).not.toBe(mine);
    await db.sql("update public.orders set status = 'Cancelled'");
  });
});

describe("size limit", () => {
  it("refuses orders over ₱1,000,000 with a clear message instead of overflowing", async () => {
    const big = await db.createUser("big_spender");
    await db.sql("update public.products set price_cents = 10000000 where id = 4"); // ₱100,000 pre-order piece
    const items = [{ product_id: 4, quantity: 99 }];
    await expect(placeOrder(db, big, { items })).rejects.toEqual(appError("invalid", /too large/));
    await expect(
      db.query(big, "select public.quote_coupon('ANY', $1::jsonb)", [JSON.stringify(items)]),
    ).rejects.toEqual(appError("invalid", /too large/));
    await db.sql("update public.products set price_cents = 32000 where id = 4");
  });
});

describe("mobile number", () => {
  let caller: Actor & { id: string };
  beforeAll(async () => {
    caller = await db.createUser("caller");
    await db.sql("update public.products set stock = 1000 where id = 1");
  });
  const contactOf = async (id: number) =>
    (await db.sql<{ contact: string }>("select contact from public.orders where id = $1", [id]))[0].contact;

  it.each(["09171234567", "0917 123 4567", "+639171234567", "63-917-123-4567", "+63 917-123-4567"])(
    "saves %s as 09XXXXXXXXX",
    async (contact) => {
      const id = await placeOrder(db, caller, { contact });
      expect(await contactOf(id)).toBe("09171234567");
      await db.sql("update public.orders set status = 'Cancelled' where id = $1", [id]);
    },
  );

  it.each(["08171234567", "0917123456", "(082) 123 4567", "+63 82 123 4567"])("rejects %s", async (contact) => {
    await expect(placeOrder(db, caller, { contact }))
      .rejects.toEqual(appError("invalid", "Enter a valid PH mobile number, e.g. 0917 123 4567."));
  });

  it("is checked again if an order's number is changed", async () => {
    const id = await placeOrder(db, caller);
    await expect(db.sql("update public.orders set contact = '12345678' where id = $1", [id])).rejects.toEqual(appError("invalid"));
    await db.sql("update public.orders set contact = '+63 918 555 0101' where id = $1", [id]);
    expect(await contactOf(id)).toBe("09185550101");
    await db.sql("update public.orders set status = 'Cancelled' where id = $1", [id]);
  });

  it("doesn't block old orders saved with another kind of number", async () => {
    const owner = await db.createUser("phone_owner", { admin: true });
    const id = await placeOrder(db, caller);
    await db.sql(`alter table public.orders disable trigger orders_contact_ph_mobile;
      update public.orders set contact = '(082) 123 4567' where id = ${id};
      alter table public.orders enable trigger orders_contact_ph_mobile;`);
    await db.query(owner, "select public.admin_set_order_status($1, 'Approved')", [id]);
    expect(await db.sql("select status, contact from public.orders where id = $1", [id]))
      .toEqual([{ status: "Approved", contact: "(082) 123 4567" }]);
  });

  it("converts old numbers the same way when the migration runs", async () => {
    const convert = async (value: string) =>
      (await db.sql<{ v: string | null }>("select private.ph_mobile($1) as v", [value]))[0].v;
    expect(await convert("0917 123 4567")).toBe("09171234567");
    expect(await convert("+63 917-123-4567")).toBe("09171234567");
    expect(await convert("(082) 123 4567")).toBeNull();
  });
});

describe("limits", () => {
  it("allows at most 3 unconfirmed orders per customer", async () => {
    const shopper = await db.createUser("shopper");
    for (let i = 0; i < 3; i++) await placeOrder(db, shopper);
    await expect(placeOrder(db, shopper)).rejects.toEqual(appError("limit"));
  });

  it("allows at most 10 orders an hour per customer", async () => {
    const busy = await db.createUser("busy");
    await db.sql("update public.products set stock = 1000 where id = 1");
    for (let i = 0; i < 10; i++) {
      await placeOrder(db, busy);
      await db.sql("update public.orders set status = 'Approved' where buyer_id = $1", [busy.id]);
    }
    await expect(placeOrder(db, busy)).rejects.toEqual(appError("limit"));
  });
});
