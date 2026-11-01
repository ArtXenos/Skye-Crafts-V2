import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
};

/**
 * The logged-in visitor, or null. Read once per request (React cache).
 *
 * getClaims() verifies the login token instead of trusting the cookie as-is.
 * This is for deciding what to *show*; the database checks permissions
 * again on every query, from the same token.
 *
 * connection(): with Partial Prefetching, cookies() already resolves while
 * the App Shell is prerendered, but getClaims() compares the token's expiry
 * with Date.now(), which Next.js refuses during prerendering. Only this check
 * waits for the real request; ordinary queries can stay in the App Shell.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const [{ data: profile }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", claims.sub).maybeSingle(),
    supabase.rpc("is_admin"),
  ]);

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    username: profile?.username ?? "",
    isAdmin: isAdmin === true,
  };
});

/** Send visitors who aren't logged in to the login page, then back here. */
export async function requireUser(returnTo: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (!user.isAdmin) redirect("/?notice=admin-only");
  return user;
}

export { safeNextPath } from "@/lib/safe-path";
