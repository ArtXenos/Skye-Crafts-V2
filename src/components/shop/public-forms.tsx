"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { submitCustomRequest, subscribeNewsletter } from "@/app/actions/shop";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Textarea } from "@/components/ui/form";
import { formResolver } from "@/components/form-resolver";
import { useActionForm } from "@/components/use-action-form";
import { customRequestSchema, newsletterSchema, type CustomRequestInput } from "@/lib/validation";

export function NewsletterForm() {
  const form = useForm<{ email: string }>({ resolver: formResolver(newsletterSchema), defaultValues: { email: "" } });
  const { submit, pending, message } = useActionForm(form, subscribeNewsletter, { onSuccess: () => form.reset() });
  const error = form.formState.errors.email?.message;
  const inputId = useId();

  return (
    <form onSubmit={submit} noValidate className="grid gap-2">
      <label htmlFor={inputId} className="font-semibold">Hear about new pieces</label>
      <div className="flex gap-2">
        <Input id={inputId} type="email" autoComplete="email" placeholder="you@example.com"
          aria-invalid={error ? true : undefined} {...form.register("email")} />
        <Button type="submit" disabled={pending} variant="secondary">Join</Button>
      </div>
      {error && <p className="text-sm font-medium text-alert">{error}</p>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </form>
  );
}

export function CustomRequestForm() {
  const form = useForm<CustomRequestInput>({
    resolver: formResolver(customRequestSchema),
    defaultValues: { name: "", contact: "", occasion: "", details: "" },
  });
  const { submit, pending, message } = useActionForm(form, submitCustomRequest, { onSuccess: () => form.reset() });
  const errors = form.formState.errors;

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message}>
          {(p) => <Input autoComplete="name" {...p} {...form.register("name")} />}
        </Field>
        <Field label="Email or mobile number" error={errors.contact?.message}>
          {(p) => <Input autoComplete="email" {...p} {...form.register("contact")} />}
        </Field>
      </div>
      <Field label="Occasion" optional error={errors.occasion?.message}>
        {(p) => <Input placeholder="Graduation, birthday, anniversary" {...p} {...form.register("occasion")} />}
      </Field>
      <Field label="Your idea" error={errors.details?.message}
        hint="Colours, size, how many pieces, a message card or charm, and a link to a reference photo if you have one.">
        {(p) => <Textarea rows={5} {...p} {...form.register("details")} />}
      </Field>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send request"}</Button>
      </div>
    </form>
  );
}
