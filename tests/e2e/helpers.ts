import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import pg from "pg";

/** Direct database access, only for test setup (for example making an admin). */
export async function sql(text: string, params: unknown[] = []) {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text, params)).rows;
  } finally {
    await client.end();
  }
}

export const run = Date.now().toString(36);

export function person(name: string) {
  return { email: `${name}-${run}@example.com`, username: `${name}_${run}`.slice(0, 30), password: `pw-${run}-long-enough` };
}

export async function register(page: Page, who: ReturnType<typeof person>) {
  // Wait for the page itself: during a client-side navigation the previous
  // page's fields are still on screen for a moment.
  await expect(page.getByRole("heading", { level: 1, name: "Create an account" })).toBeVisible();
  await page.getByLabel("Email").filter({ visible: true }).fill(who.email);
  await page.getByLabel("Username").filter({ visible: true }).fill(who.username);
  await page.getByLabel("Password", { exact: true }).filter({ visible: true }).fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function logIn(page: Page, who: ReturnType<typeof person>, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await page.getByLabel("Email").filter({ visible: true }).fill(who.email);
  await page.getByLabel("Password", { exact: true }).filter({ visible: true }).fill(who.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname === next.split("?")[0]);
}

export async function logOut(page: Page) {
  await page.context().clearCookies();
}

/** No WCAG A/AA violations on the current page. */
export async function expectAccessible(page: Page) {
  // Let entrance animations (toasts, the hero) finish: axe measures colours
  // as drawn, and a half-faded element always "fails" contrast.
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

/** A tiny valid PNG, for upload tests. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
