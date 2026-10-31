"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { deleteReview, removeSubscriber, saveSettings, updateCustomRequest } from "@/app/actions/admin";
import { formResolver } from "@/components/form-resolver";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/use-action-form";
import { REQUEST_STATUSES } from "@/lib/shop";
import { requestUpdateSchema, settingsSchema, type RequestUpdateInput, type SettingKey, type SettingsInput } from "@/lib/validation";

export function RequestUpdateForm({ initial }: { initial: RequestUpdateInput }) {
  const form = useForm<RequestUpdateInput>({ resolver: formResolver(requestUpdateSchema), defaultValues: initial });
  const { submit, pending, message } = useActionForm(form, updateCustomRequest, { successToast: true });
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-[10rem_9rem_1fr_auto] sm:items-end">
      <Field label="Status" error={errors.status?.message}>
        {(p) => <Select {...p} {...form.register("status")}>{REQUEST_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>}
      </Field>
      <Field label="Quote (₱)" error={errors.quote?.message}>
        {(p) => <Input inputMode="decimal" {...p} {...form.register("quote")} />}
      </Field>
      <Field label="Reply to customer" error={errors.shop_note?.message}>
        {(p) => <Textarea rows={1} {...p} {...form.register("shop_note")} />}
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>Save</Button>
      {message?.tone === "error" && <Notice tone="error" className="sm:col-span-4">{message.text}</Notice>}
    </form>
  );
}

export function RemoveButton({ id, kind, label }: { id: number; kind: "review" | "subscriber"; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} aria-label={label}
      onClick={() => {
        if (!window.confirm(`${label}? This can't be undone.`)) return;
        startTransition(async () => {
          const result = kind === "review" ? await deleteReview(id) : await removeSubscriber(id);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        });
      }}>
      Remove
    </Button>
  );
}

export function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="secondary" size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(emails.join(", "));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Couldn't copy. Select the addresses in the list instead.");
        }
      }}>
      {copied ? "Copied" : `Copy all ${emails.length} addresses`}
    </Button>
  );
}

const SETTING_FIELDS: { title: string; fields: { key: SettingKey; label: string; hint?: string; long?: boolean }[] }[] = [
  {
    title: "Pickup and payment (private)",
    fields: [
      { key: "pickup_location", label: "Pickup location", hint: "Only shown to a customer after you confirm their pickup order.", long: true },
      { key: "gcash_name", label: "GCash account name", hint: "Shown to a customer on their unpaid GCash order." },
      { key: "gcash_number", label: "GCash number" },
    ],
  },
  {
    title: "Shown to everyone",
    fields: [
      { key: "public_area", label: "Town or area", hint: "Shown instead of the exact pickup place, for example Davao City." },
      { key: "pickup_schedule", label: "Pickup times", long: true },
      { key: "shipping_note", label: "Shipping", long: true },
      { key: "lead_time_ready", label: "Lead time for ready pieces" },
      { key: "lead_time_custom", label: "Lead time for custom pieces" },
      { key: "cancellation_note", label: "Cancellation policy", long: true },
      { key: "damaged_note", label: "Damaged items", long: true },
      { key: "refund_note", label: "Refunds", long: true },
      { key: "contact_phone", label: "Contact number", hint: "Shown in the footer. Leave empty to hide." },
      { key: "facebook_url", label: "Facebook page link", hint: "A full https:// link. Leave empty to hide." },
      { key: "tiktok_url", label: "TikTok link", hint: "A full https:// link. Leave empty to hide." },
    ],
  },
  {
    title: "Shop rules",
    fields: [
      { key: "unpaid_order_hours", label: "Hours before an unpaid order is cancelled", hint: "1 to 168. Orders with a receipt, or that you confirmed, never expire." },
      { key: "low_stock_threshold", label: "Warn me when stock is at or below" },
    ],
  },
];

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const form = useForm<SettingsInput>({ resolver: formResolver(settingsSchema), defaultValues: initial });
  const { submit, pending, message } = useActionForm(form, saveSettings, { successToast: true });
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="grid gap-10">
      {SETTING_FIELDS.map((group) => (
        <fieldset key={group.title} className="grid gap-5">
          <legend className="mb-2 font-display text-2xl">{group.title}</legend>
          {group.fields.map((field) => (
            <Field key={field.key} label={field.label} hint={field.hint} error={errors[field.key]?.message}>
              {(p) => field.long
                ? <Textarea rows={3} {...p} {...form.register(field.key)} />
                : <Input {...p} {...form.register(field.key)} />}
            </Field>
          ))}
        </fieldset>
      ))}
      {message?.tone === "error" && <Notice tone="error">{message.text}</Notice>}
      <div className="sticky bottom-4">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}
