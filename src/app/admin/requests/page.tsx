import { Suspense } from "react";
import { RequestUpdateForm } from "@/components/admin/small-forms";
import { requireAdmin } from "@/lib/auth";
import { centsToPesoInput } from "@/lib/money";
import type { RequestStatus } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

async function AdminRequests() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: requests, error } = await supabase
    .from("custom_requests")
    .select("*, profiles(username)")
    .order("id", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  return (
    <div className="grid gap-6">
      <h1 className="text-3xl">Custom requests</h1>
      <p className="text-ink-soft">Customers with an account see the status, quote and your reply under My orders. Guests only get what you send them directly.</p>
      {requests.length === 0 ? (
        <p className="rounded-2xl bg-petal p-6">No requests yet.</p>
      ) : (
        <ul className="grid gap-5">
          {requests.map((request) => (
            <li key={request.id} className="grid gap-4 rounded-2xl p-5 ring-2 ring-line">
              <div className="grid gap-1">
                <p className="font-semibold">
                  {request.name}{request.occasion ? `, ${request.occasion}` : ""}
                  <span className="font-normal text-ink-soft"> ({request.profiles ? `account ${request.profiles.username}` : "guest"}, {formatDateTime(request.created_at)})</span>
                </p>
                {request.edited_at && (
                  <p className="text-sm font-semibold text-bloom-deep">Edited by customer {formatDateTime(request.edited_at)}</p>
                )}
                <p>Contact: <span className="font-semibold">{request.contact}</span></p>
                <p className="whitespace-pre-line rounded-xl bg-paper p-3">{request.details}</p>
              </div>
              <RequestUpdateForm initial={{
                id: request.id, status: request.status as RequestStatus,
                quote: centsToPesoInput(request.quote_cents), shop_note: request.shop_note,
              }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Loading…</p>}>
      <AdminRequests />
    </Suspense>
  );
}
