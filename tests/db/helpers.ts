import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, expect, inject } from "vitest";
import { baseUrl, dropDatabase, urlFor } from "./global-setup";

export type Actor =
  | { role: "anon" }
  | { role: "authenticated"; id: string }
  | { role: "service_role" };

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export const anon: Actor = { role: "anon" };
export const service: Actor = { role: "service_role" };

/** A fresh copy of the template database for one test file. */
export class TestDb {
  pool!: pg.Pool;
  private name = `skye_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;

  async open() {
    const admin = new pg.Client({ connectionString: baseUrl() });
    await admin.connect();
    await admin.query(`create database ${this.name} template ${inject("templateDatabase")}`);
    await admin.end();
    this.pool = new pg.Pool({ connectionString: urlFor(this.name), max: 6 });
  }

  async close() {
    await this.pool.end();
    const admin = new pg.Client({ connectionString: baseUrl() });
    await admin.connect();
    await dropDatabase(admin, this.name);
    await admin.end();
  }

  /** Run SQL as the database owner (no RLS), for test setup. */
  async sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
    return (await this.pool.query(text, params)).rows as T[];
  }

  /**
   * Run SQL exactly as Supabase would for a request from this actor: inside a
   * transaction, switched to the anon / authenticated / service_role role,
   * with the JWT claims that auth.uid() reads.
   */
  async as<T>(actor: Actor, fn: (q: Query) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(`set local role ${actor.role}`);
      const claims = actor.role === "authenticated" ? { sub: actor.id, role: actor.role } : { role: actor.role };
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const q: Query = async (text, params = []) => (await client.query(text, params)).rows;
      const result = await fn(q);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Shorthand for one statement as an actor. */
  query<T = Record<string, unknown>>(actor: Actor, text: string, params: unknown[] = []) {
    return this.as(actor, (q) => q<T>(text, params));
  }

  async createUser(username: string, options: { admin?: boolean } = {}): Promise<Actor & { id: string }> {
    const [user] = await this.sql<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [`${username}@example.com`, { username }],
    );
    if (options.admin) {
      await this.sql("update public.profiles set is_admin = true where id = $1", [user.id]);
    }
    return { role: "authenticated", id: user.id };
  }
}

/** Open a fresh database before this file's tests and drop it after. */
export function setupTestDb() {
  const db = new TestDb();
  beforeAll(() => db.open());
  afterAll(() => db.close());
  return db;
}

export type CheckoutInput = {
  items?: unknown;
  recipient?: string;
  contact?: string;
  fulfillment?: string;
  address?: string;
  payment?: string;
  note?: string;
  coupon?: string;
  key?: string | null;
};

export function checkoutParams(input: CheckoutInput = {}) {
  return [
    JSON.stringify(input.items ?? [{ product_id: 1, quantity: 1 }]),
    input.recipient ?? "Test Buyer",
    input.contact ?? "0917 123 4567",
    input.fulfillment ?? "delivery",
    input.address ?? "123 Rizal Street, Davao City",
    input.payment ?? "gcash",
    input.note ?? "",
    input.coupon ?? "",
    input.key ?? null,
  ];
}

export async function placeOrder(db: TestDb, actor: Actor, input: CheckoutInput = {}) {
  const [row] = await db.query<{ id: string }>(
    actor,
    "select public.place_order($1::jsonb, $2, $3, $4, $5, $6, $7, $8, $9) as id",
    checkoutParams(input),
  );
  return Number(row.id);
}

export async function stockOf(db: TestDb, productId: number) {
  const [row] = await db.sql<{ stock: number }>("select stock from public.products where id = $1", [productId]);
  return row.stock;
}

/** Matches a P0001 error raised by private.fail(kind, message). */
export function appError(kind: string, message?: string | RegExp) {
  return expect.objectContaining({
    code: "P0001",
    hint: kind,
    ...(message === undefined ? {} : { message: typeof message === "string" ? message : expect.stringMatching(message) }),
  });
}
