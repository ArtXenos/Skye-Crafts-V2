// After checkout: status changes, cancelling, other people's orders,
// expiry of unpaid orders, receipts, and the private shop details.
import { beforeAll, describe, expect, it } from "vitest";
import { appError, placeOrder, stockOf, setupTestDb, type Actor } from "./helpers";

const db = setupTestDb();
let alice: Actor & { id: string };
let bob: Actor & { id: string };
let admin: Actor & { id: string };

const setStatus = (actor: Actor, id: number, status: string, note = "") =>
  db.query(actor, "select public.admin_set_order_status($1, $2, $3)", [id, status, note]);
const cancel = (actor: Actor, id: number) => db.query(actor, "select public.cancel_order($1)", [id]);
const confirm = (actor: Actor, id: number) => db.query(actor, "select public.confirm_receipt($1)", [id]);
const details = async (actor: Actor, id: number) =>
  (await db.query<{ d: Record<string, string> }>(actor, "select public.order_private_details($1) as d", [id]))[0].d;
const statusOf = async (id: number) =>
  (await db.sql<{ status: string }>("select status from public.orders where id = $1", [id]))[0].status;

beforeAll(async () => {
  alice = await db.createUser("alice");
  bob = await db.createUser("bob");
  admin = await db.createUser("owner", { admin: true });
  await db.sql("update public.products set stock = 1000 where id in (1, 2, 3)");
  await db.sql(`update public.shop_settings set value = case key
      when 'pickup_location' then 'Blk 1 Lot 2, Secret Street'
      when 'pickup_schedule' then 'Saturdays 9-11 AM'
      when 'pickup_coordinates' then '7.073100,125.612800'
      when 'gcash_name' then 'S. C.'
      when 'gcash_number' then '0917 000 0000'
      else value end`);
});

describe("the normal journey", () => {
  it("goes Placed → Approved → Packed → Shipped → Delivered", async () => {
    const id = await placeOrder(db, alice);
    for (const status of ["Approved", "Packed", "Shipped"]) {
      await setStatus(admin, id, status, `now ${status}`);
      expect(await statusOf(id)).toBe(status);
    }
    await confirm(alice, id);
    expect(await statusOf(id)).toBe("Delivered");

    const events = await db.query<{ status: string; actor: string }>(alice,
      "select status, actor from public.order_events where order_id = $1 order by id", [id]);
    expect(events.map((e) => `${e.status}:${e.actor}`)).toEqual([
      "Placed:customer", "Approved:shop", "Packed:shop", "Shipped:shop", "Delivered:customer",
    ]);
    const [order] = await db.sql("select status_note, expires_at from public.orders where id = $1", [id]);
    expect(order).toEqual({ status_note: "now Shipped", expires_at: null });
  });

  it("refuses skipped or backwards steps", async () => {
    const id = await placeOrder(db, alice);
    await expect(setStatus(admin, id, "Shipped")).rejects.toEqual(appError("conflict"));
    await setStatus(admin, id, "Approved");
    await expect(setStatus(admin, id, "Declined")).rejects.toEqual(appError("conflict"));
    await expect(confirm(alice, id)).rejects.toEqual(appError("conflict"));
    await expect(setStatus(admin, id, "Placed")).rejects.toEqual(appError("invalid"));
    await setStatus(admin, id, "Cancelled");
  });

  it("only lets admins change statuses", async () => {
    const id = await placeOrder(db, alice);
    await expect(setStatus(alice, id, "Approved")).rejects.toEqual(appError("forbidden"));
    await cancel(alice, id);
  });
});

describe("cancelling and declining", () => {
  it("returns stock when the customer cancels", async () => {
    const before = await stockOf(db, 2);
    const id = await placeOrder(db, alice, { items: [{ product_id: 2, quantity: 4 }] });
    expect(await stockOf(db, 2)).toBe(before - 4);
    await cancel(alice, id);
    expect(await stockOf(db, 2)).toBe(before);
  });

  it("returns stock when the shop declines, and only once", async () => {
    const before = await stockOf(db, 2);
    const id = await placeOrder(db, alice, { items: [{ product_id: 2, quantity: 3 }] });
    await setStatus(admin, id, "Declined", "Out of pink wire");
    expect(await stockOf(db, 2)).toBe(before);
    await expect(cancel(alice, id)).rejects.toEqual(appError("conflict"));
    expect(await stockOf(db, 2)).toBe(before);
  });

  it("lets the customer cancel until the order is packed", async () => {
    const id = await placeOrder(db, alice);
    await setStatus(admin, id, "Approved");
    await setStatus(admin, id, "Packed");
    await expect(cancel(alice, id)).rejects.toEqual(appError("conflict", /already packed/));
    await setStatus(admin, id, "Cancelled", "Customer asked by message");
  });
});

describe("other people's orders", () => {
  it("can't be cancelled, confirmed or inspected by another customer", async () => {
    const id = await placeOrder(db, alice);
    await expect(cancel(bob, id)).rejects.toEqual(appError("not_found"));
    await expect(confirm(bob, id)).rejects.toEqual(appError("not_found"));
    await expect(details(bob, id)).rejects.toEqual(appError("not_found"));
    await expect(
      db.query(bob, "select public.attach_receipt($1, $2)", [id, `${bob.id}/r.jpg`]),
    ).rejects.toEqual(appError("invalid"));
    expect(await statusOf(id)).toBe("Placed");
    await cancel(alice, id);
  });
});

describe("private shop details", () => {
  it("shows GCash details only while a GCash order waits for payment", async () => {
    const id = await placeOrder(db, alice);
    expect(await details(alice, id)).toEqual({ gcash_name: "S. C.", gcash_number: "0917 000 0000" });
    await setStatus(admin, id, "Approved");
    expect(await details(alice, id)).toEqual({});
    await cancel(alice, id);
  });

  it("hides the pickup location until the shop approves the order", async () => {
    const id = await placeOrder(db, alice, { fulfillment: "pickup", payment: "cash_on_pickup" });
    expect(await details(alice, id)).toEqual({});
    await setStatus(admin, id, "Approved");
    expect(await details(alice, id)).toEqual({
      pickup_location: "Blk 1 Lot 2, Secret Street",
      pickup_schedule: "Saturdays 9-11 AM",
      pickup_coordinates: "7.073100,125.612800",
    });
    await cancel(alice, id);
    expect(await details(alice, id)).toEqual({});
  });

  it("is not readable from the settings table by customers", async () => {
    expect(await db.query(alice, "select value from public.shop_settings where key = 'pickup_location'")).toHaveLength(0);
    expect(await db.query(alice, "select value from public.shop_settings where key = 'pickup_coordinates'")).toHaveLength(0);
  });

  it("leaves the map pin out when the shop hasn't set one", async () => {
    await db.sql("update public.shop_settings set value = '' where key = 'pickup_coordinates'");
    try {
      const id = await placeOrder(db, alice, { fulfillment: "pickup", payment: "cash_on_pickup" });
      await setStatus(admin, id, "Approved");
      expect(await details(alice, id)).not.toHaveProperty("pickup_coordinates");
      await cancel(alice, id);
    } finally {
      await db.sql("update public.shop_settings set value = '7.073100,125.612800' where key = 'pickup_coordinates'");
    }
  });
});

describe("receipts", () => {
  let carol: Actor & { id: string };
  beforeAll(async () => {
    carol = await db.createUser("carol");
  });

  it("attaches a receipt the customer uploaded to their own folder", async () => {
    const id = await placeOrder(db, carol);
    const path = `${carol.id}/order-${id}.jpg`;
    await expect(db.query(carol, "select public.attach_receipt($1, $2)", [id, path])).rejects.toEqual(appError("invalid", "Upload the receipt first."));
    await db.query(carol, "insert into storage.objects (bucket_id, name) values ('receipts', $1)", [path]);
    await db.query(carol, "select public.attach_receipt($1, $2)", [id, path]);
    const [order] = await db.sql("select receipt_path from public.orders where id = $1", [id]);
    expect(order).toEqual({ receipt_path: path });
    await cancel(carol, id);
  });

  it("refuses paths outside the customer's folder", async () => {
    const id = await placeOrder(db, carol);
    for (const path of [`${bob.id}/x.jpg`, `${carol.id}/../x.jpg`, `${carol.id}/a/b.jpg`, "x.jpg"]) {
      await expect(db.query(carol, "select public.attach_receipt($1, $2)", [id, path])).rejects.toEqual(appError("invalid"));
    }
    await cancel(carol, id);
  });
});

describe("unpaid order expiry", () => {
  let dan: Actor & { id: string };
  beforeAll(async () => {
    dan = await db.createUser("dan");
  });

  it("cancels overdue orders without a receipt and returns their stock", async () => {
    const before = await stockOf(db, 3);
    const unpaid = await placeOrder(db, dan, { items: [{ product_id: 3, quantity: 2 }] });
    const withReceipt = await placeOrder(db, dan, { items: [{ product_id: 3, quantity: 1 }] });
    const fresh = await placeOrder(db, dan, { items: [{ product_id: 3, quantity: 1 }] });
    await db.sql("update public.orders set expires_at = now() - interval '1 minute' where id in ($1, $2)", [unpaid, withReceipt]);
    await db.sql("update public.orders set receipt_path = 'x' where id = $1", [withReceipt]);

    const [{ n }] = await db.query<{ n: number }>(bob, "select public.expire_stale_orders() as n");
    expect(n).toBe(1);
    expect(await statusOf(unpaid)).toBe("Cancelled");
    expect(await statusOf(withReceipt)).toBe("Placed");
    expect(await statusOf(fresh)).toBe("Placed");
    expect(await stockOf(db, 3)).toBe(before - 2);

    const [event] = await db.sql("select actor, actor_id from public.order_events where order_id = $1 order by id desc limit 1", [unpaid]);
    expect(event).toEqual({ actor: "system", actor_id: null });
  });

  it("never expires an order the shop already approved", async () => {
    const id = await placeOrder(db, bob);
    await setStatus(admin, id, "Approved");
    await db.sql("update public.orders set expires_at = now() - interval '1 day' where id = $1", [id]);
    await db.query(bob, "select public.expire_stale_orders()");
    expect(await statusOf(id)).toBe("Approved");
  });
});
