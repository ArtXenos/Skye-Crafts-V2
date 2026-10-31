"use client";

import { useState, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/**
 * Connects a react-hook-form form to a Server Action: shows the server's
 * field errors next to the right inputs, and the overall message above the
 * button (or as a toast on success).
 */
export function useActionForm<TValues extends FieldValues, TData>(
  form: UseFormReturn<TValues>,
  action: (values: TValues) => Promise<ActionResult<TData>>,
  options: { onSuccess?: (data: TData) => void; successToast?: boolean } = {},
) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const submit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action(values);
      if (!result) return; // the action redirected
      if (result.ok) {
        if (result.message) {
          if (options.successToast) toast.success(result.message);
          else setMessage({ tone: "success", text: result.message });
        }
        options.onSuccess?.(result.data);
        return;
      }
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        const field = key.startsWith("form.") ? key.slice(5) : key; // nested checkout fields
        form.setError(field as Path<TValues>, { message: messages[0] });
      }
      setMessage({ tone: "error", text: result.message });
    });
  });

  return { submit, pending, message, setMessage };
}
