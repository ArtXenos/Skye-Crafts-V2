// update_custom_request: customers change their own open requests, and
// nothing else.
import { beforeAll, describe, expect, it } from "vitest";
import { anon, appError, setupTestDb, type Actor } from "./helpers";

const db = setupTestDb();
let alice: Actor & { id: string };
let bob: Actor & { id: string };
let admin: Actor & { id: string };

beforeAll(async () => {
  alice = await db.createUser("alice");
  bob = await db.createUser("bob");
  admin = await db.createUser("owner", { admin: true });
});

/** A request as the shop has left it, made directly for the test. */
async function requestFor(userId: string | null, status = "New", quote: number | null = null) {
  const [row] = await db.sql<{ id: string }>(
    `insert into public.custom_requests (user_id, name, contact, occasion, details, status, quote_cents, shop_note)
     values ($1, 'Alice', 'alice@example.com', 'Birthday', 'A pink bouquet with 12 roses', $2, $3, 'From the shop')
     returning id`,
    [userId, status, quote],
  );
  return Number(row.id);
}

const edit = (actor: Actor, id: number, details = "A blue bouquet with 6 roses and a card") =>
  db.query(actor, "select public.update_custom_request($1, '0917 123 4567', 'Graduation', $2) as status", [id, details]);

const read = async (id: number) =>
  (await db.sql("select contact, occasion, details, status, quote_cents, shop_note, edited_at from public.custom_requests where id = $1", [id]))[0];

describe("customers editing their requests", () => {
  it("lets the owner edit a New request", async () => {
    const id = await requestFor(alice.id);
    expect(await edit(alice, id)).toEqual([{ status: "New" }]);
    expect(await read(id)).toMatchObject({
      contact: "0917 123 4567", occasion: "Graduation", details: "A blue bouquet with 6 roses and a card",
      status: "New", quote_cents: null, shop_note: "From the shop", edited_at: expect.any(Date),
    });
  });

  it("puts a Quoted request back to New and withdraws the quote", async () => {
    const id = await requestFor(alice.id, "Quoted", 75000);
    await edit(alice, id);
    expect(await read(id)).toMatchObject({ status: "New", quote_cents: null, shop_note: "From the shop", details: "A blue bouquet with 6 roses and a card" });
  });

  it("doesn't let another customer edit it", async () => {
    const id = await requestFor(alice.id);
    await expect(edit(bob, id)).rejects.toEqual(appError("not_found", "Request not found."));
    expect(await read(id)).toMatchObject({ details: "A pink bouquet with 12 roses", edited_at: null });
  });

  it("doesn't let guests or visitors who aren't logged in edit", async () => {
    const guestRequest = await requestFor(null);
    await expect(edit(alice, guestRequest)).rejects.toEqual(appError("not_found"));
    await expect(edit(admin, guestRequest)).rejects.toEqual(appError("not_found"));
    const own = await requestFor(alice.id);
    await expect(edit(anon, own)).rejects.toMatchObject({ code: "42501" });
    await expect(edit(anon, guestRequest)).rejects.toMatchObject({ code: "42501" });
    expect(await read(guestRequest)).toMatchObject({ edited_at: null });
  });

  it.each(["In progress", "Completed", "Declined"])("refuses once the request is %s", async (status) => {
    const id = await requestFor(alice.id, status, 75000);
    await expect(edit(alice, id)).rejects.toEqual(appError("conflict", "This request is locked. Contact the shop to change it."));
    expect(await read(id)).toMatchObject({ status, quote_cents: 75000, edited_at: null });
  });

  it("checks the same lengths as a new request", async () => {
    const id = await requestFor(alice.id);
    await expect(edit(alice, id, "too short")).rejects.toEqual(appError("invalid"));
    await expect(edit(alice, id, "x".repeat(2001))).rejects.toEqual(appError("invalid"));
    await expect(db.query(alice, "select public.update_custom_request($1, 'abc', '', 'A long enough idea')", [id]))
      .rejects.toEqual(appError("invalid"));
    await expect(db.query(alice, "select public.update_custom_request($1, 'alice@example.com', $2, 'A long enough idea')", [id, "x".repeat(101)]))
      .rejects.toEqual(appError("invalid"));
  });

  it("can't change the status, quote or shop note", async () => {
    const id = await requestFor(alice.id, "Quoted", 75000);
    // The function takes only the three fields...
    await expect(db.query(alice, "select public.update_custom_request($1, 'a@b.co', '', 'A long enough idea', 'Completed')", [id]))
      .rejects.toMatchObject({ code: "42883" });
    // ...and customers can't write those columns (or edited_at) directly.
    expect(await db.query(alice, "update public.custom_requests set status = 'Completed', quote_cents = 1, shop_note = 'x' where id = $1 returning id", [id]))
      .toEqual([]);
    await expect(db.query(alice, "update public.custom_requests set details = 'Changed directly!!' where id = $1", [id]))
      .rejects.toMatchObject({ code: "42501" });
    await expect(db.query(alice, "update public.custom_requests set edited_at = now() where id = $1", [id]))
      .rejects.toMatchObject({ code: "42501" });
    expect(await read(id)).toMatchObject({ status: "Quoted", quote_cents: 75000, shop_note: "From the shop", edited_at: null });
  });

  it("leaves edited_at to the function, even for admins", async () => {
    const id = await requestFor(alice.id);
    await expect(db.query(admin, "update public.custom_requests set edited_at = now() where id = $1", [id]))
      .rejects.toMatchObject({ code: "42501" });
  });
});
