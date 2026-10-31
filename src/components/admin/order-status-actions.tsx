"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOrderStatus } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { ADMIN_NEXT_STEPS, type OrderStatus } from "@/lib/shop";

/** The next steps for an order, with an optional note the customer will see. */
export function OrderStatusActions({ orderId, status }: { orderId: number; status: string }) {
  const steps = ADMIN_NEXT_STEPS[status] ?? [];
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<OrderStatus | null>(null);

  if (steps.length === 0) {
    return <p className="text-ink-soft">This order is finished; there are no more steps.</p>;
  }

  function apply(target: OrderStatus) {
    setChosen(target);
    startTransition(async () => {
      const result = await setOrderStatus({ orderId, status: target, note });
      if (result.ok) {
        toast.success(result.message);
        setNote("");
      } else toast.error(result.message);
      setChosen(null);
    });
  }

  return (
    <div className="grid gap-4">
      <Field label="Note for the customer" optional hint="Shown on their order page and in the email. Say why if you decline or cancel."
        error={note.length > 300 ? "Keep it to 300 characters." : undefined}>
        {(p) => <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} {...p} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <Button key={step.status} variant={step.needsNote ? "danger" : "primary"} disabled={pending}
            onClick={() => {
              if (step.needsNote && !note.trim() && !window.confirm(`${step.label} without a note? The customer won't know why.`)) return;
              apply(step.status);
            }}>
            {pending && chosen === step.status ? "Saving…" : step.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
