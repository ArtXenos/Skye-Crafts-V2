import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

/**
 * An anonymous, stable key for the visitor's network address, used only for
 * rate limits on the public forms. The address itself is never stored: it is
 * mixed with a server secret and hashed, so the stored value can't be
 * reversed or matched against a list of addresses.
 *
 * On Vercel, x-forwarded-for is set by Vercel's edge network and can't be
 * forged by the visitor. Behind another proxy, check how it sets this header.
 */
export async function clientHash() {
  const list = await headers();
  const address =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip")?.trim() ||
    "unknown";
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  return createHmac("sha256", secret).update(`client:${address}`).digest("hex");
}
