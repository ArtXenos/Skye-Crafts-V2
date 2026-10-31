// Coupons: the "Apply" check and checkout share one set of rules.
import { beforeAll, describe, expect, it } from "vitest";
import { appError, placeOrder, setupTestDb, type Actor } from "./helpers";

const db = setupTestDb();
let buyer: Actor & { id: string };

const cart = (items = [{ product_id: 1, quantity: 2 }]) => JSON.stringify(items); // ₱900.00

async function coupon(code: string, fields: Record<string, unknown> = {}) {
  const row = {
    discount_type: "percentage",
    discount_value: 10,
    max_discount_cents: 0,
    min_order_cents: 0,
    max_uses: 0,
    once_per_customer: true,
    starts_on: "today",
    ends_on: "today",
    is_active: true,
    ...fields,
  };
  const day = (value: unknown) =>
    value === "today" ? "(now() at time zone 'Asia/Manila')::date" : `'${value}'::date`;
  await db.sql(
    `insert into public.coupons (code, discount_type, discount_value, max_discount_cents, min_order_cents,
       max_uses, once_per_customer, starts_on, ends_on, is_active)
     values ($1, $2, $3, $4, $5, $6, $7, ${day(row.starts_on)}, ${day(row.ends_on)}, $8)`,
    [code, row.discount_type, row.discount_value, row.max_discount_cents, row.min_order_cents,
      row.max_uses, row.once_per_customer, row.is_active],
  );
}

// quote_coupon returns {ok: false, kind, message} for coupon problems; turn
// that into a thrown error shaped like the raised ones so tests read alike.
async function quote(actor: Actor, code: string, items?: { product_id: number; quantity: number }[]) {
  const [row] = await db.query<{ q: Record<string, number | string | boolean> }>(
    actor, "select public.quote_coupon($1, $2::jsonb) as q", [code, cart(items)]);
  const { ok, kind, message, ...rest } = row.q;
  if (!ok) throw { code: "P0001", hint: kind, message };
  return rest;
}

beforeAll(async () => {
  buyer = await db.createUser("buyer");
  await db.sql("update public.products set stock = 1000 where id in (1, 2, 3)");
});

describe("quote_coupon", () => {
  it("computes a percentage discount, case-insensitively", async () => {
    await coupon("TEN");
    expect(await quote(buyer, " ten ")).toEqual({ code: "TEN", subtotal_cents: 90000, discount_cents: 9000, total_cents: 81000 });
  });

  it("caps a percentage discount", async () => {
    await coupon("CAPPED", { discount_value: 50, max_discount_cents: 10000 });
    expect((await quote(buyer, "CAPPED")).discount_cents).toBe(10000);
  });

  it("never discounts more than the subtotal", async () => {
    await coupon("HUGE", { discount_type: "fixed", discount_value: 10000000 });
    expect(await quote(buyer, "HUGE")).toMatchObject({ discount_cents: 90000, total_cents: 0 });
  });

  it.each([
    ["an unknown code", "NOPE", "not_found"],
    ["a code with bad characters", "<script>", "not_found"],
  ])("rejects %s", async (_label, code, kind) => {
    await expect(quote(buyer, code)).rejects.toEqual(appError(kind));
  });

  it("rejects inactive, early, expired and used-up coupons", async () => {
    await coupon("OFF", { is_active: false });
    await coupon("SOON", { starts_on: "2999-01-01", ends_on: "2999-12-31" });
    await coupon("OLD", { starts_on: "2020-01-01", ends_on: "2020-12-31" });
    await coupon("GONE", { max_uses: 1 });
    await db.sql("update public.coupons set used_count = 1 where code = 'GONE'");
    await expect(quote(buyer, "OFF")).rejects.toEqual(appError("invalid", "This coupon is no longer active."));
    await expect(quote(buyer, "SOON")).rejects.toEqual(appError("invalid", /valid starting January 1, 2999/));
    await expect(quote(buyer, "OLD")).rejects.toEqual(appError("invalid", "This coupon has expired."));
    await expect(quote(buyer, "GONE")).rejects.toEqual(appError("invalid", "This coupon has reached its usage limit."));
  });

  it("enforces a minimum order", async () => {
    await coupon("BIG", { min_order_cents: 100000 });
    await expect(quote(buyer, "BIG")).rejects.toEqual(appError("invalid", "This coupon needs a minimum order of ₱1,000.00."));
    expect((await quote(buyer, "BIG", [{ product_id: 1, quantity: 3 }])).discount_cents).toBe(13500);
  });

  it("rate-limits guessing", async () => {
    const guesser = await db.createUser("guesser");
    for (let i = 0; i < 20; i++) await quote(guesser, "NOPE").catch(() => undefined);
    await expect(quote(guesser, "TEN")).rejects.toEqual(appError("limit"));
  });
});

describe("coupons at checkout", () => {
  it("applies the discount and counts the use", async () => {
    await coupon("USEME", { discount_type: "fixed", discount_value: 5000, once_per_customer: false });
    await quote(buyer, "USEME");
    const id = await placeOrder(db, buyer, { coupon: "useme", items: [{ product_id: 1, quantity: 2 }] });
    const [order] = await db.sql("select subtotal_cents, discount_cents, total_cents, coupon_code from public.orders where id = $1", [id]);
    expect(order).toEqual({ subtotal_cents: 90000, discount_cents: 5000, total_cents: 85000, coupon_code: "USEME" });
    const [c] = await db.sql<{ used_count: number }>("select used_count from public.coupons where code = 'USEME'");
    expect(c.used_count).toBe(1);
    await db.query(buyer, "select public.cancel_order($1)", [id]);
  });

  it("gives the use back when the order is cancelled", async () => {
    const [c] = await db.sql<{ used_count: number }>("select used_count from public.coupons where code = 'USEME'");
    expect(c.used_count).toBe(0);
  });

  it("allows a once-per-customer coupon once, and again after a cancellation", async () => {
    await coupon("ONCE");
    await quote(buyer, "ONCE");
    const first = await placeOrder(db, buyer, { coupon: "ONCE" });
    await expect(quote(buyer, "ONCE")).rejects.toEqual(appError("invalid", "You've already used this coupon."));
    await expect(placeOrder(db, buyer, { coupon: "ONCE" })).rejects.toEqual(appError("conflict", "You've already used this coupon."));
    await db.query(buyer, "select public.cancel_order($1)", [first]);
    await quote(buyer, "ONCE");
    const again = await placeOrder(db, buyer, { coupon: "ONCE" });
    expect(again).toBeGreaterThan(first);
    await db.query(buyer, "select public.cancel_order($1)", [again]);
  });

  it("re-checks the coupon at checkout (it may have changed since Apply)", async () => {
    await coupon("FLAKY");
    await quote(buyer, "FLAKY");
    await db.sql("update public.coupons set is_active = false where code = 'FLAKY'");
    await expect(placeOrder(db, buyer, { coupon: "FLAKY" })).rejects.toEqual(appError("conflict"));
  });

  it("enforces the usage limit across customers", async () => {
    await coupon("LAST1", { max_uses: 1 });
    const other = await db.createUser("other");
    await quote(buyer, "LAST1");
    await quote(other, "LAST1");
    await placeOrder(db, buyer, { coupon: "LAST1" });
    await expect(placeOrder(db, other, { coupon: "LAST1" })).rejects.toEqual(appError("conflict", "This coupon has reached its usage limit."));
  });
});

describe("guessing codes at checkout", () => {
  it("only accepts a coupon the customer checked with Apply, and answers unknown codes the same way", async () => {
    const guesser = await db.createUser("checkout_guesser");
    await coupon("NOTQUOTED");
    const message = "Apply the coupon again, then place your order.";
    await expect(placeOrder(db, guesser, { coupon: "NOTQUOTED" })).rejects.toEqual(appError("conflict", message));
    await expect(placeOrder(db, guesser, { coupon: "NOSUCHCODE" })).rejects.toEqual(appError("conflict", message));
    await quote(guesser, "NOTQUOTED");
    await placeOrder(db, guesser, { coupon: "NOTQUOTED" });
  });

  it("forgets a check after an hour", async () => {
    const late = await db.createUser("late_quoter");
    await coupon("STALE");
    await quote(late, "STALE");
    await db.sql("update private.coupon_quotes set quoted_at = now() - interval '61 minutes' where user_id = $1", [late.id]);
    await expect(placeOrder(db, late, { coupon: "STALE" })).rejects.toEqual(appError("conflict"));
  });
});

describe("coupon data rules", () => {
  it.each([
    ["a lowercase code", { code: "lower" }],
    ["a percentage over 100", { discount_value: 150 }],
    ["an end before the start", { starts_on: "2026-05-02", ends_on: "2026-05-01" }],
    ["a fixed discount over ₱100,000", { discount_type: "fixed", discount_value: 10000001 }],
  ])("refuses %s", async (_label, fields) => {
    const { code = "BADONE", ...rest } = fields as { code?: string };
    await expect(coupon(code, rest)).rejects.toMatchObject({ code: "23514" });
  });
});
