// Builds one template database (Supabase stand-in + every migration + seed).
// Each test file then clones it, which takes milliseconds, so tests never
// see each other's data.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";

export const TEMPLATE = "skye_template";

export function baseUrl() {
  return process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54322/postgres";
}

export function urlFor(database: string) {
  const url = new URL(baseUrl());
  url.pathname = `/${database}`;
  return url.toString();
}

export async function dropDatabase(admin: pg.Client, name: string) {
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
    [name],
  );
  await admin.query(`drop database if exists ${name}`);
}

function sqlFiles() {
  const root = path.resolve(__dirname, "../..");
  const migrations = path.join(root, "supabase/migrations");
  return [
    path.join(root, "tests/db/supabase-stub.sql"),
    ...readdirSync(migrations)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => path.join(migrations, file)),
    path.join(root, "supabase/seed.sql"),
  ];
}

export default async function setup(project: TestProject) {
  const admin = new pg.Client({ connectionString: baseUrl() });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Could not connect to PostgreSQL at ${baseUrl()}. ` +
        "Start one (for example `npx supabase start`) or set TEST_DATABASE_URL. " +
        `Original error: ${(error as Error).message}`,
    );
  }

  await dropDatabase(admin, TEMPLATE);
  await admin.query(`create database ${TEMPLATE} template template0`);

  const template = new pg.Client({ connectionString: urlFor(TEMPLATE) });
  await template.connect();
  await template.query("set client_min_messages = warning");
  for (const file of sqlFiles()) {
    try {
      await template.query(readFileSync(file, "utf8"));
    } catch (error) {
      throw new Error(`${path.basename(file)}: ${(error as Error).message}`);
    }
  }
  await template.end();

  project.provide("templateDatabase", TEMPLATE);

  return async () => {
    await dropDatabase(admin, TEMPLATE);
    await admin.end();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    templateDatabase: string;
  }
}
