// Row Level Security and privileges: who can see and change what when they
// talk to the database directly (the way anyone with the public anon key can).
import { beforeAll, describe, expect, it } from "vitest";
import { anon, placeOrder, setupTestDb, type Actor } from "./helpers";

const db = setupTestDb();
let alice: Actor & { id: string };
let bob: Actor & { id: string };
let admin: Actor & { id: string };

beforeAll(async () => {
  alice = await db.createUser("alice");
  bob = await db.createUser("bob");
  admin = await db.createUser("owner", { admin: true });
  await db.sql("update public.products set is_active = false where id = 4");
});

describe("catalogue", () => {
  it("shows only active products to visitors", async () => {
    const rows = await db.query<{ id: string }>(anon, "select id from public.products order by id");
    expect(rows.map((r) => Number(r.id))).toEqual([1, 2, 3]);
  });

  it("shows hidden products to admins", async () => {
    const rows = await db.query(admin, "select id from public.products");
    expect(rows).toHaveLength(4);
  });

  it("does not let visitors or customers change products", async () => {
    await expect(
      db.query(anon, "insert into public.products (title, description, category, price_cents) values ('X X X', 'd', 'Fuzzy Wire Pots', 100)"),
    ).rejects.toMatchObject({ code: "42501" });
    const updated = await db.query(alice, "update public.products set price_cents = 1 where id = 1 returning id");
    expect(updated).toHaveLength(0);
    await expect(
      db.query(alice, "insert into public.products (title, description, category, price_cents) values ('X X X', 'd', 'Fuzzy Wire Pots', 100)"),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("lets admins add and edit products", async () => {
    const [row] = await db.query<{ id: string }>(
      admin,
      "insert into public.products (title, description, category, price_cents, stock) values ('Tiny Tulip', 'A tulip.', 'Flower Bouquets', 9900, 3) returning id",
    );
    const updated = await db.query(admin, "update public.products set stock = 5 where id = $1 returning stock", [row.id]);
    expect(updated).toEqual([{ stock: 5 }]);
  });

  it("files each variety under one of the five categories", async () => {
    // The starter products moved to the new names and kept their ids and prices.
    const starters = await db.sql<{ title: string; category: string; price_cents: number }>(
      "select title, category, price_cents from public.products where id <= 4 order by id",
    );
    expect(starters).toEqual([
      { title: "Fuzzy Wire Bouquet", category: "Flower Bouquets", price_cents: 45000 },
      { title: "Mirror Keychain", category: "Keychains", price_cents: 15000 },
      { title: "Fuzzy Wire Pot", category: "Fuzzy Wire Pots", price_cents: 28000 },
      { title: "Desk Figurine", category: "Desk Figurines", price_cents: 32000 },
    ]);
    const add = (title: string, category: string) =>
      db.query(admin, "insert into public.products (title, description, category, price_cents) values ($1, 'A variety.', $2, 9900) returning id", [title, category]);
    expect(await add("Daisy Hair Clip", "Accessories")).toHaveLength(1);
    expect(await add("Beaded Bracelet", "Accessories")).toHaveLength(1);
    expect(await add("Tulip Keychain", "Keychains")).toHaveLength(1);
    for (const old of ["Bouquets", "Pots", "Figurines", "Hair clips"]) {
      await expect(add("Old Name", old), old).rejects.toMatchObject({ code: "23514" });
    }
  });
});

describe("profiles", () => {
  it("creates a profile with the chosen username on sign-up", async () => {
    const rows = await db.query(anon, "select username from public.profiles where id = $1", [alice.id]);
    expect(rows).toEqual([{ username: "alice" }]);
  });

  it("falls back to a generated username when the chosen one is taken", async () => {
    const [user] = await db.sql<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ('dup@example.com', '{\"username\":\"ALICE\"}') returning id",
    );
    const [profile] = await db.sql<{ username: string }>("select username from public.profiles where id = $1", [user.id]);
    expect(profile.username).toMatch(/^user_[0-9a-f]{10}$/);
  });

  it("hides who is an admin", async () => {
    await expect(db.query(anon, "select is_admin from public.profiles")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query(alice, "select is_admin from public.profiles")).rejects.toMatchObject({ code: "42501" });
  });

  it("does not let a customer make themselves an admin", async () => {
    await expect(
      db.query(alice, "update public.profiles set is_admin = true where id = $1", [alice.id]),
    ).rejects.toMatchObject({ code: "42501" });
    const [row] = await db.query<{ is_admin: boolean }>(alice, "select public.is_admin() as is_admin");
    expect(row.is_admin).toBe(false);
  });

  it("lets a customer rename only themselves", async () => {
    expect(await db.query(alice, "update public.profiles set username = 'alice_k' where id = $1 returning id", [alice.id])).toHaveLength(1);
    expect(await db.query(alice, "update public.profiles set username = 'hacked' where id = $1 returning id", [bob.id])).toHaveLength(0);
  });
});

describe("orders", () => {
  it("keeps each customer's orders private", async () => {
    const orderId = await placeOrder(db, alice);
    expect(await db.query(bob, "select id from public.orders where id = $1", [orderId])).toHaveLength(0);
    expect(await db.query(bob, "select id from public.order_items where order_id = $1", [orderId])).toHaveLength(0);
    expect(await db.query(bob, "select id from public.order_events where order_id = $1", [orderId])).toHaveLength(0);
    expect(await db.query(alice, "select id from public.orders where id = $1", [orderId])).toHaveLength(1);
    expect(await db.query(admin, "select id from public.orders where id = $1", [orderId])).toHaveLength(1);
  });

  it("hides which admin account changed an order", async () => {
    const orderId = await placeOrder(db, alice);
    await db.query(admin, "select public.admin_set_order_status($1, 'Approved')", [orderId]);
    await expect(
      db.query(alice, "select actor_id from public.order_events where order_id = $1", [orderId]),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await db.query(alice, "select status, actor from public.order_events where order_id = $1 order by id", [orderId]))
      .toEqual([{ status: "Placed", actor: "customer" }, { status: "Approved", actor: "shop" }]);
    const events = await db.query<{ actor_name: string }>(admin, "select actor_name from public.admin_order_events($1)", [orderId]);
    expect(events.map((e) => e.actor_name)).toEqual([expect.stringMatching(/^alice/), "owner"]);
    await expect(db.query(alice, "select * from public.admin_order_events($1)", [orderId])).rejects.toMatchObject({ code: "P0001", hint: "forbidden" });
    await db.query(admin, "select public.admin_set_order_status($1, 'Cancelled')", [orderId]);
  });

  it("allows no direct writes to orders, even of your own", async () => {
    await expect(
      db.query(alice, "update public.orders set total_cents = 1 where buyer_id = $1", [alice.id]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(alice, "insert into public.orders (buyer_id, recipient, contact, fulfillment, payment_method, subtotal_cents, total_cents) values ($1, 'Al', '09171234567', 'pickup', 'gcash', 1, 1)", [alice.id]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(admin, "update public.orders set status = 'Delivered'"),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("does not let visitors call checkout", async () => {
    await expect(placeOrder(db, anon)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("coupons, subscribers and requests", () => {
  beforeAll(async () => {
    await db.sql("insert into public.coupons (code, discount_type, discount_value, starts_on, ends_on) values ('SECRET10', 'percentage', 10, current_date, current_date)");
    await db.sql("insert into public.newsletter_subscribers (email) values ('fan@example.com')");
  });

  it("hides coupon codes from everyone but admins", async () => {
    await expect(db.query(anon, "select code from public.coupons")).rejects.toMatchObject({ code: "42501" });
    expect(await db.query(alice, "select code from public.coupons")).toHaveLength(0);
    expect(await db.query(admin, "select code from public.coupons")).toHaveLength(1);
  });

  it("hides the subscriber list from everyone but admins", async () => {
    expect(await db.query(alice, "select email from public.newsletter_subscribers")).toHaveLength(0);
    expect(await db.query(admin, "select email from public.newsletter_subscribers")).toHaveLength(1);
  });

  it("does not let customers update custom requests", async () => {
    await db.sql("insert into public.custom_requests (user_id, name, contact, details) values ($1, 'Alice', 'alice@example.com', 'A big bouquet please')", [alice.id]);
    const changed = await db.query(alice, "update public.custom_requests set quote_cents = 1 returning id");
    expect(changed).toHaveLength(0);
    expect(await db.query(alice, "select id from public.custom_requests")).toHaveLength(1);
    expect(await db.query(bob, "select id from public.custom_requests")).toHaveLength(0);
  });
});

describe("settings", () => {
  it("shows public settings but hides private ones", async () => {
    const rows = await db.query<{ key: string }>(anon, "select key from public.shop_settings");
    const keys = rows.map((r) => r.key);
    expect(keys).toContain("shipping_note");
    expect(keys).not.toContain("pickup_location");
    expect(keys).not.toContain("gcash_number");
    expect(keys).not.toContain("pickup_coordinates");
  });

  it("lets admins (only) change values", async () => {
    expect(await db.query(alice, "update public.shop_settings set value = 'x' where key = 'public_area' returning key")).toHaveLength(0);
    expect(await db.query(admin, "update public.shop_settings set value = 'Davao City' where key = 'public_area' returning key")).toHaveLength(1);
    await expect(
      db.query(admin, "update public.shop_settings set is_private = false where key = 'gcash_number'"),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects values the shop can't use", async () => {
    await expect(db.query(admin, "update public.shop_settings set value = '0' where key = 'unpaid_order_hours'")).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(admin, "update public.shop_settings set value = 'javascript:alert(1)' where key = 'facebook_url'")).rejects.toMatchObject({ code: "23514" });
    await expect(db.query(admin, "update public.shop_settings set value = repeat('9', 31) where key = 'gcash_number'")).rejects.toMatchObject({ code: "23514" });
  });

  it("only takes a real latitude,longitude for the map pin", async () => {
    const pin = (value: string) =>
      db.query(admin, "update public.shop_settings set value = $1 where key = 'pickup_coordinates' returning value", [value]);
    expect(await pin("7.073100,125.612800")).toHaveLength(1);
    expect(await pin("-33.868800,151.209300")).toHaveLength(1);
    expect(await pin("")).toHaveLength(1);
    for (const bad of ["125.6128,7.0731", "7.07,181", "Davao City", "7.07, 125.61", "1e2,3", "7.07,125.61,3"]) {
      await expect(pin(bad), bad).rejects.toMatchObject({ code: "23514" });
    }
  });
});

describe("receipt storage", () => {
  it("lets customers upload only into their own folder", async () => {
    await db.query(alice, "insert into storage.objects (bucket_id, name) values ('receipts', $1)", [`${alice.id}/r1.jpg`]);
    await expect(
      db.query(alice, "insert into storage.objects (bucket_id, name) values ('receipts', $1)", [`${bob.id}/r1.jpg`]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("lets customers read only their own receipts", async () => {
    expect(await db.query(alice, "select name from storage.objects where bucket_id = 'receipts'")).toHaveLength(1);
    expect(await db.query(bob, "select name from storage.objects where bucket_id = 'receipts'")).toHaveLength(0);
    expect(await db.query(admin, "select name from storage.objects where bucket_id = 'receipts'")).toHaveLength(1);
  });

  it("lets admins (only) see and delete product images through the API", async () => {
    await db.sql("insert into storage.objects (bucket_id, name) values ('product-images', 'old.jpg')");
    expect(await db.query(alice, "delete from storage.objects where bucket_id = 'product-images' returning name")).toHaveLength(0);
    expect(await db.query(admin, "select name from storage.objects where bucket_id = 'product-images' and name = 'old.jpg'")).toHaveLength(1);
    expect(await db.query(admin, "delete from storage.objects where name = 'old.jpg' returning name")).toHaveLength(1);
  });

  it("lets only admins upload product images", async () => {
    await expect(
      db.query(alice, "insert into storage.objects (bucket_id, name) values ('product-images', 'x.jpg')"),
    ).rejects.toMatchObject({ code: "42501" });
    await db.query(admin, "insert into storage.objects (bucket_id, name) values ('product-images', 'x.jpg')");
  });
});
