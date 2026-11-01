import { Suspense } from "react";
import { CopyEmailsButton, RemoveButton } from "@/components/admin/small-forms";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

async function AdminSubscribers() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: subscribers, error } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, created_at")
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Newsletter subscribers</h1>
        {subscribers.length > 0 && <CopyEmailsButton emails={subscribers.map((s) => s.email)} />}
      </div>
      <p className="text-ink-soft">Paste the addresses into the BCC field of your email, so subscribers can&apos;t see each other.</p>
      {subscribers.length === 0 ? (
        <p className="rounded-2xl bg-petal p-6">No subscribers yet. The sign-up form is in the shop&apos;s footer.</p>
      ) : (
        <ul className="grid divide-y-2 divide-line rounded-2xl ring-2 ring-line">
          {subscribers.map((subscriber) => (
            <li key={subscriber.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span>{subscriber.email} <span className="text-sm text-ink-soft">since {formatDateTime(subscriber.created_at)}</span></span>
              <RemoveButton id={subscriber.id} kind="subscriber" label={`Remove ${subscriber.email}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminSubscribersPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <AdminSubscribers />
    </Suspense>
  );
}
