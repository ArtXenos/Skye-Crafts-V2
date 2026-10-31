"use server";

import { redirect } from "next/navigation";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { safeNextPath } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation";

type AuthError = { code?: string; message: string; status?: number } | null;

/** Supabase Auth errors, in words a customer can act on. */
function authFailure(error: AuthError) {
  switch (error?.code) {
    case "invalid_credentials":
      return failure("That email and password don't match an account.");
    case "email_not_confirmed":
      return failure("Confirm your email first: open the link we sent you, then log in.");
    case "user_already_exists":
    case "email_exists":
      return failure("An account with that email already exists. Log in instead, or reset your password.");
    case "weak_password":
      return failure("Choose a stronger password: at least 10 characters, not a common one.");
    case "same_password":
      return failure("Choose a password different from your current one.");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return failure("Too many attempts. Please wait a few minutes and try again.");
    case "signup_disabled":
      return failure("New accounts can't be created right now.");
    default:
      console.error("[auth]", error);
      return failure("Something went wrong. Please try again.");
  }
}

// Logging in, signing up and logging out return where to go next, and the
// browser then does a full page load there (see auth-forms.tsx). Every page
// can look different after a login, and a full load guarantees nothing kept
// from before (cached pages, hidden forms) survives.

export async function signUp(input: unknown, next: unknown): Promise<ActionResult<{ redirectTo: string | null }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, username, password } = parsed.data;

  const supabase = await createClient();
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username.replaceAll("_", "\\_"))
    .maybeSingle();
  if (taken) {
    return failure("Check the highlighted fields.", { fieldErrors: { username: ["That username is taken. Try another."] } });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      // After confirming, continue where they were (for example checkout).
      emailRedirectTo: `${SITE_URL}/auth/confirm?next=${encodeURIComponent(safeNextPath(next))}`,
    },
  });
  if (error) return authFailure(error);

  // With email confirmation on (the default), there is no session yet: the
  // person must open the link we emailed. Otherwise they're logged in now.
  if (data.session) {
    const target = safeNextPath(next);
    return success({ redirectTo: target === "/account" ? "/account?notice=welcome" : target });
  }
  return success({ redirectTo: null });
}

export async function signIn(input: unknown, next: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return authFailure(error);
  return success({ redirectTo: safeNextPath(next) });
}

export async function signOut(): Promise<ActionResult<{ redirectTo: string }>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return success({ redirectTo: "/" });
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/reset-password`,
  });
  if (error && error.code !== "user_not_found") return authFailure(error);
  // Same answer whether or not the account exists.
  return success(null, "If that email has an account, a reset link is on its way. Check your inbox.");
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return failure("Your reset link has expired. Request a new one.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return authFailure(error);
  redirect("/account?notice=password-updated");
}
