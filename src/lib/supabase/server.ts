import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { assertSupabaseConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase as the person making this request (their login cookie). Row
 * Level Security in the database decides what they can see and change.
 * Create a new one per request; never share it.
 */
export async function createClient() {
  assertSupabaseConfigured();
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's fine: src/proxy.ts
          // refreshes the session on every request before rendering.
        }
      },
    },
  });
}

/**
 * Supabase as an anonymous visitor, with no cookies. Used for public data
 * (catalogue, reviews, public settings) inside "use cache" functions, which
 * are shared between all visitors and so must never see a login.
 */
export function createPublicClient() {
  assertSupabaseConfigured();
  return createPlainClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Supabase with the secret key: bypasses Row Level Security. Only used for
 * the two public forms (custom requests, newsletter), whose database
 * functions accept calls from the server alone so their rate limit can't be
 * dodged. Never import this into a Client Component.
 */
export function createServiceClient() {
  assertSupabaseConfigured();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY is not set (see .env.example).");
  }
  return createPlainClient<Database>(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
