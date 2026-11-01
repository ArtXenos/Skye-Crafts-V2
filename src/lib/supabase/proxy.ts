import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Refresh the visitor's Supabase session (if any) before the page renders,
 * and write the refreshed cookies onto both the request (so this render sees
 * them) and the response (so the browser keeps them).
 *
 * This is not an access check: pages and the database still check
 * permissions themselves.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached and shared.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Reading the claims is what triggers a refresh of an expired token.
  const { data } = await supabase.auth.getClaims();

  // Admin pages render alongside the admin layout's gate, so without this a
  // logged-out visit runs their queries (which the database refuses) before
  // the gate's redirect. The gate still checks that the user is an admin.
  if (!data?.claims?.sub && request.nextUrl.pathname.startsWith("/admin")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return response;
}
