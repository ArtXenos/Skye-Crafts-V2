// What every Server Action returns to the browser. Actions never return raw
// database rows or error objects: only what the form needs to show.
import type { z } from "zod";
import { fieldErrors } from "@/lib/validation";

export type ActionResult<T = null> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]>; kind?: string };

export function success<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function failure(message: string, extra: { fieldErrors?: Record<string, string[]>; kind?: string } = {}) {
  return { ok: false as const, message, ...extra };
}

export function invalid(error: z.ZodError) {
  return failure("Check the highlighted fields.", { fieldErrors: fieldErrors(error) });
}

type DatabaseError = { code?: string; message?: string; hint?: string | null } | null;

/**
 * Turn a Supabase/Postgres error into a message that is safe to show.
 * Errors raised on purpose by our database functions (code P0001) carry a
 * customer-friendly message; anything else is logged and replaced.
 */
export function fromDatabaseError(error: DatabaseError, context: string) {
  if (error?.code === "P0001" && error.message) {
    return failure(error.message, { kind: error.hint ?? undefined });
  }
  if (error?.code === "42501") {
    return failure("You don't have permission to do that.", { kind: "forbidden" });
  }
  if (error?.code === "23505") {
    return failure("That already exists.", { kind: "conflict" });
  }
  if (error?.code === "23514" || error?.code === "22P02") {
    return failure("One of the values isn't allowed. Check the form and try again.", { kind: "invalid" });
  }
  console.error(`[${context}]`, error);
  return failure("Something went wrong on our side. Please try again.");
}
