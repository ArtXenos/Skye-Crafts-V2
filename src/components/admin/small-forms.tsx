"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { deleteReview, removeSubscriber, saveSettings, updateCustomRequest } from "@/app/actions/admin";
import { formResolver } from "@/components/form-resolver";
import { LeafletMap } from "@/components/map/leaflet-map";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select, Textarea } from "@/components/ui/form";
import { useActionForm } from "@/components/use-action-form";
import { formatCoordinates, parseCoordinates } from "@/lib/geo";
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

const SETTING_FIELDS: { title: string; fields: { key: SettingKey; label: string; hint?: string; long?: boolean; map?: boolean }[] }[] = [
  {
    title: "Pickup and payment (private)",
    fields: [
      { key: "pickup_location", label: "Pickup location", hint: "Only shown to a customer after you confirm their pickup order.", long: true },
      {
        key: "pickup_coordinates",
        label: "Pickup map pin",
        hint: "Tap the map below, or paste coordinates or a Google Maps link (in Google Maps, long-press the place and copy the numbers). Shown with the address, only on confirmed pickup orders. Leave empty for no map.",
        map: true,
      },
      { key: "gcash_name", label: "GCash account name", hint: "Shown to a customer on their unpaid GCash order." },
      { key: "gcash_number", label: "GCash number" },
    ],
  },
  {
    title: "Shown to everyone",
    fields: [
      { key: "public_area", label: "Town or area", hint: "Where you deliver and where pickup is, for example Governor Generoso, Davao Oriental. Shown instead of the exact pickup place." },
      { key: "pickup_schedule", label: "Pickup times", long: true },
      { key: "shipping_note", label: "Delivery", long: true },
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
  // A pasted Google Maps link becomes plain "lat,lng" once the owner leaves the field.
  const tidyPin = (value: string) => {
    const point = parseCoordinates(value);
    if (point && value !== formatCoordinates(point)) {
      form.setValue("pickup_coordinates", formatCoordinates(point), { shouldDirty: true, shouldValidate: true });
    }
  };
  return (
    <form onSubmit={submit} noValidate className="grid gap-10">
      {SETTING_FIELDS.map((group) => (
        <fieldset key={group.title} className="grid gap-5">
          <legend className="mb-2 font-display text-2xl">{group.title}</legend>
          {group.fields.map((field) => (
            <div key={field.key} className="grid gap-3">
              <Field label={field.label} hint={field.hint} error={errors[field.key]?.message}>
                {(p) => field.long
                  ? <Textarea rows={3} {...p} {...form.register(field.key)} />
                  : <Input {...p} {...form.register(field.key, field.map ? { onBlur: (event) => tidyPin(event.target.value) } : undefined)} />}
              </Field>
              {field.map && <PinPicker form={form} name={field.key} />}
            </div>
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

/** The admin map: shows the pin typed in the field above, and tapping the map moves it. */
function PinPicker({ form, name }: { form: UseFormReturn<SettingsInput>; name: SettingKey }) {
  const value = useWatch({ control: form.control, name });
  const point = parseCoordinates(value ?? "");
  return (
    <div className="grid gap-2">
      <LeafletMap
        point={point}
        label="Map for choosing the pickup pin"
        onPick={(picked) => form.setValue(name, formatCoordinates(picked), { shouldDirty: true, shouldValidate: true })}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <span>{point ? "Drag and zoom to check it's the right spot, then save." : "No pin yet. Zoom in and tap the pickup place."}</span>
        {point && (
          <Button type="button" variant="secondary" size="sm" onClick={() => form.setValue(name, "", { shouldDirty: true, shouldValidate: true })}>
            Remove pin
          </Button>
        )}
      </div>
    </div>
  );
}
