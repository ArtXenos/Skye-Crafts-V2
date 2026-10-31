"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelOrder, confirmReceipt, uploadReceipt } from "@/app/actions/shop";
import { Button } from "@/components/ui/button";
import { guardPhotoSize } from "@/components/file-size-guard";
import { Notice } from "@/components/ui/form";
import type { ActionResult } from "@/lib/action-result";

export function CancelOrderButton({ orderId }: { orderId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return <Button variant="danger" onClick={() => setConfirming(true)}>Cancel order</Button>;
  }
  return (
    <div className="grid gap-3 rounded-[var(--radius-field)] bg-alert-soft p-4" role="group" aria-label="Confirm cancelling">
      <p className="font-semibold text-alert">Cancel order #{orderId}? This can&apos;t be undone.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await cancelOrder(orderId);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
            setConfirming(false);
          })}>
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)}>Keep my order</Button>
      </div>
    </div>
  );
}

export function ConfirmReceiptButton({ orderId, pickup }: { orderId: number; pickup: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button disabled={pending}
      onClick={() => startTransition(async () => {
        const result = await confirmReceipt(orderId);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      })}>
      {pickup ? "I picked it up" : "I received it"}
    </Button>
  );
}

export function ReceiptUpload({ orderId, hasReceipt }: { orderId: number; hasReceipt: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(uploadReceipt, null);
  const inputId = useId();
  const [tooBig, setTooBig] = useState("");
  return (
    <form action={action} onSubmit={(event) => guardPhotoSize(event, setTooBig)} className="grid gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor={inputId} className="font-semibold">
        {hasReceipt ? "Upload a different screenshot" : "Upload your GCash payment screenshot"}
      </label>
      <input id={inputId} name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required
        className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:font-semibold file:text-paper hover:file:bg-ink-soft" />
      <p className="text-sm text-ink-soft">JPG, PNG or WebP, up to 4 MB. Only you and the shop can see it.</p>
      {tooBig ? <Notice tone="error">{tooBig}</Notice> : result && <Notice tone={result.ok ? "success" : "error"}>{result.message}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload screenshot"}</Button>
      </div>
    </form>
  );
}
