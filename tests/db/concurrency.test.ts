// Several checkouts at the same moment, on separate connections.
import { beforeAll, describe, expect, it } from "vitest";
import { placeOrder, stockOf, setupTestDb, type Actor } from "./helpers";

const db = setupTestDb();
let buyers: (Actor & { id: string })[];

beforeAll(async () => {
  buyers = [];
  for (let i = 0; i < 5; i++) buyers.push(await db.createUser(`racer${i}`));
});

describe("races", () => {
  it("sells the last item exactly once", async () => {
    await db.sql("update public.products set stock = 1 where id = 1");
    const results = await Promise.allSettled(
      buyers.map((buyer) => placeOrder(db, buyer, { items: [{ product_id: 1, quantity: 1 }] })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await stockOf(db, 1)).toBe(0);
  });

  it("hands out a one-use coupon exactly once", async () => {
    await db.sql("update public.products set stock = 100 where id = 2");
    await db.sql(`insert into public.coupons (code, discount_type, discount_value, max_uses, starts_on, ends_on)
      values ('RACE', 'percentage', 10, 1, current_date - 1, current_date + 1)`);
    for (const buyer of buyers) {
      await db.query(buyer, "select public.quote_coupon('RACE', '[{\"product_id\":2,\"quantity\":1}]'::jsonb)");
    }
    const results = await Promise.allSettled(
      buyers.map((buyer) => placeOrder(db, buyer, { items: [{ product_id: 2, quantity: 1 }], coupon: "RACE" })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [c] = await db.sql<{ used_count: number }>("select used_count from public.coupons where code = 'RACE'");
    expect(c.used_count).toBe(1);
  });

  it("places one order when the same checkout is sent twice at once", async () => {
    const key = "double-click-key-0001";
    const [a, b] = await Promise.all([
      placeOrder(db, buyers[0], { items: [{ product_id: 2, quantity: 1 }], key }),
      placeOrder(db, buyers[0], { items: [{ product_id: 2, quantity: 1 }], key }),
    ]);
    expect(a).toBe(b);
  });

  it("does not deadlock when expiry runs during checkouts", async () => {
    await db.sql("update public.products set stock = 100 where id in (1, 2, 3)");
    const stale = await placeOrder(db, buyers[4], { items: [{ product_id: 3, quantity: 1 }, { product_id: 1, quantity: 1 }] });
    await db.sql("update public.orders set expires_at = now() - interval '1 minute' where id = $1", [stale]);
    const work = [
      db.query(buyers[1], "select public.expire_stale_orders()"),
      ...buyers.slice(1, 4).map((buyer) =>
        placeOrder(db, buyer, { items: [{ product_id: 1, quantity: 1 }, { product_id: 3, quantity: 1 }] }).catch((e) => e)),
      db.query(buyers[2], "select public.expire_stale_orders()"),
    ];
    const results = await Promise.all(work);
    for (const result of results) {
      expect(result).not.toMatchObject({ code: "40P01" });
    }
    const [{ status }] = await db.sql<{ status: string }>("select status from public.orders where id = $1", [stale]);
    expect(status).toBe("Cancelled");
  });
});
