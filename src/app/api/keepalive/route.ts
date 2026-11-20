// GET /api/keepalive — called once a day by Vercel Cron (vercel.json).
//
// Supabase pauses free-plan projects after a week without activity. The shop's
// pages are cached, so a quiet week could otherwise take the database (and the
// shop) offline. This makes one tiny read so the project counts as active.
//
// Vercel sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET
// environment variable is set; anyone else gets a 401, so the route can't be
// used to hammer the database.
import type { NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { error } = await createPublicClient().from("products").select("id").limit(1);
  if (error) {
    console.error("[keepalive]", error);
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
