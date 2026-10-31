// Reviews, the public forms, and the admin-only reports.
import { beforeAll, describe, expect, it } from "vitest";
import { anon, appError, placeOrder, service, setupTestDb, type Actor } from "./helpers";

const db = setupTestDb();
let alice: Actor & { id: string };
let bob: Actor & { id: string };
let admin: Actor & { id: string };
const hash = (n: number) => n.toString(16).padStart(64, "0");

beforeAll(async () => {
  alice = await db.createUser("alice");
  bob = await db.createUser("bob");
  admin = await db.createUser("owner", { admin: true });
});

describe("reviews", () => {
  const review = (actor: Actor, productId: number, rating: number, body = "") =>
    db.query(actor, "select public.submit_review($1, $2, $3)", [productId, rating, body]);

  it("are only for customers who received the item", async () => {
    await expect(review(alice, 1, 5)).rejects.toEqual(appError("forbidden"));
    const id = await placeOrder(db, alice);
    await db.query(admin, "select public.admin_set_order_status($1, 'Approved')", [id]);
    await expect(review(alice, 1, 5)).rejects.toEqual(appError("forbidden"));
    for (const status of ["Packed", "Shipped", "Delivered"]) {
      await db.query(admin, "select public.admin_set_order_status($1, $2)", [id, status]);
    }
    const [{ ok }] = await db.query<{ ok: boolean }>(alice, "select public.can_review(1) as ok");
    expect(ok).toBe(true);
    await review(alice, 1, 5, "Lovely!");
  });

  it("are summarised per product for everyone", async () => {
    expect(await db.query(anon, "select product_id, average, count from public.product_ratings"))
      .toEqual([{ product_id: "1", average: 5, count: 1 }]);
  });

  it("replace the customer's earlier review instead of adding another", async () => {
    await review(alice, 1, 3, "Changed my mind");
    const rows = await db.query(anon, "select rating, body from public.reviews where product_id = 1");
    expect(rows).toEqual([{ rating: 3, body: "Changed my mind" }]);
  });

  it("are public, with the reviewer's username", async () => {
    const rows = await db.query(anon,
      "select r.rating, p.username from public.reviews r join public.profiles p on p.id = r.user_id");
    expect(rows).toEqual([{ rating: 3, username: "alice" }]);
  });

  it("can't be written directly or deleted by someone else", async () => {
    await expect(
      db.query(bob, "insert into public.reviews (product_id, user_id, rating) values (2, $1, 5)", [bob.id]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await db.query(bob, "delete from public.reviews returning id")).toHaveLength(0);
    expect(await db.query(admin, "delete from public.reviews returning id")).toHaveLength(1);
  });

  it("validate the rating and length", async () => {
    await expect(review(alice, 1, 6)).rejects.toEqual(appError("invalid"));
    await expect(review(alice, 1, 4, "x".repeat(1001))).rejects.toEqual(appError("invalid"));
  });
});

describe("custom requests and newsletter", () => {
  const request = (actor: Actor, clientHash: string, userId: string | null = null) =>
    db.query(actor, "select public.submit_custom_request($1, $2, 'Maria', 'maria@example.com', 'Birthday', 'A pink bouquet with 12 roses') as id", [userId, clientHash]);

  it("can only be submitted through the server", async () => {
    await expect(request(anon, hash(1))).rejects.toMatchObject({ code: "42501" });
    await expect(request(alice, hash(1))).rejects.toMatchObject({ code: "42501" });
    await request(service, hash(1), alice.id);
    expect(await db.query(alice, "select status from public.custom_requests")).toEqual([{ status: "New" }]);
  });

  it("are rate limited per client", async () => {
    for (let i = 0; i < 5; i++) await request(service, hash(2));
    await expect(request(service, hash(2))).rejects.toEqual(appError("limit"));
    await request(service, hash(3));
  });

  it("subscribe an address once, without saying whether it was already there", async () => {
    const subscribe = (email: string, n: number) =>
      db.query(service, "select public.subscribe_newsletter($1, $2)", [hash(n), email]);
    await subscribe("Fan@Example.com ", 10);
    await subscribe("fan@example.com", 11);
    expect(await db.query(admin, "select email from public.newsletter_subscribers")).toEqual([{ email: "fan@example.com" }]);
    await expect(subscribe("not-an-email", 12)).rejects.toEqual(appError("invalid"));
  });

  it("let admins quote a custom request", async () => {
    const changed = await db.query(admin,
      "update public.custom_requests set status = 'Quoted', quote_cents = 75000, shop_note = 'Ready in a week' where user_id = $1 returning status",
      [alice.id]);
    expect(changed).toEqual([{ status: "Quoted" }]);
  });
});

describe("admin reports", () => {
  beforeAll(async () => {
    await db.sql("update public.products set stock = 1000 where id in (1, 2, 3)");
    const bobOrder = await placeOrder(db, bob, { recipient: "Bob 100% Real", contact: "0918 555 0101" });
    await db.query(admin, "select public.admin_set_order_status($1, 'Approved')", [bobOrder]);
  });

  it("are admin-only", async () => {
    await expect(db.query(alice, "select public.admin_summary()")).rejects.toEqual(appError("forbidden"));
    await expect(db.query(alice, "select public.admin_search_orders()")).rejects.toEqual(appError("forbidden"));
    await expect(db.query(anon, "select public.admin_summary()")).rejects.toMatchObject({ code: "42501" });
  });

  it("search orders by number, name and contact, with paging", async () => {
    const search = async (status: string | null, query: string, limit = 20, offset = 0) =>
      (await db.query<{ r: { total: number; orders: { id: number; recipient: string; buyer: string }[] } }>(
        admin, "select public.admin_search_orders($1, $2, $3, $4) as r", [status, query, limit, offset]))[0].r;

    const all = await search(null, "");
    expect(all.total).toBe(2);
    expect(all.orders[0].id).toBeGreaterThan(all.orders[1].id);

    expect((await search(null, "100%")).orders.map((o) => o.buyer)).toEqual(["bob"]);
    expect((await search(null, "100_")).total).toBe(0);  // "_" is literal, not a wildcard
    expect((await search(null, "0918")).total).toBe(1);
    expect((await search(null, `#${all.orders[1].id}`)).orders[0].id).toBe(all.orders[1].id);
    expect((await search("Approved", "")).total).toBe(1);
    const page = await search(null, "", 1, 1);
    expect(page).toMatchObject({ total: 2 });
    expect(page.orders).toHaveLength(1);
  });

  it("summarise sales, statuses and low stock", async () => {
    await db.sql("update public.products set stock = 2 where id = 2");
    const [{ s }] = await db.query<{ s: Record<string, unknown> }>(admin, "select public.admin_summary() as s");
    expect(s).toMatchObject({
      status_counts: { Delivered: 1, Approved: 1 },
      new_requests: 6,
      low_stock: [{ id: 2, title: "Mirror Keychain", stock: 2 }],
    });
    expect(s.sales_30d_cents).toBe(45000 * 2);
  });
});
