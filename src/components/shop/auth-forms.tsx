"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { requestPasswordReset, signIn, signOut, signUp, updatePassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/form";
import { formResolver } from "@/components/form-resolver";
import { useActionForm } from "@/components/use-action-form";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, type LoginInput, type RegisterInput } from "@/lib/validation";

/**
 * Next.js keeps recently visited pages alive but hidden. Clear typed
 * passwords and emails when a login or sign-up page is left.
 */
function useClearWhenHidden(reset: () => void) {
  const latest = useRef(reset);
  useLayoutEffect(() => {
    latest.current = reset;
  });
  // Runs only when the page is hidden or left, never while typing.
  useLayoutEffect(() => () => latest.current(), []);
}

const linkClass = "font-semibold underline decoration-bloom-deep underline-offset-4";

export function LoginForm({ next }: { next: string }) {
  const form = useForm<LoginInput>({ resolver: formResolver(loginSchema), defaultValues: { email: "", password: "" } });
  useClearWhenHidden(form.reset);
  const { submit, pending, message } = useActionForm(form, (values: LoginInput) => signIn(values, next), {
    onSuccess: ({ redirectTo }) => window.location.assign(redirectTo),
  });
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input type="email" autoComplete="email" {...p} {...form.register("email")} />}
      </Field>
      <Field label="Password" error={errors.password?.message}>
        {(p) => <Input type="password" autoComplete="current-password" {...p} {...form.register("password")} />}
      </Field>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Logging in…" : "Log in"}</Button>
      <p className="text-sm"><Link href="/forgot-password" className={linkClass}>Forgot your password?</Link></p>
      <p className="text-ink-soft">New here? <Link href={`/register?next=${encodeURIComponent(next)}`} className={`${linkClass} text-ink`}>Create an account</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [sentTo, setSentTo] = useState("");
  const form = useForm<RegisterInput>({ resolver: formResolver(registerSchema), defaultValues: { email: "", username: "", password: "" } });
  useClearWhenHidden(form.reset);
  const { submit, pending, message } = useActionForm(form, (values: RegisterInput) => signUp(values, next), {
    onSuccess: ({ redirectTo }) => {
      if (redirectTo) window.location.assign(redirectTo);
      else setSentTo(form.getValues("email")); // email confirmation needed
    },
  });
  const errors = form.formState.errors;

  if (sentTo) {
    return (
      <Notice tone="success">
        Almost done: we sent a link to <strong>{sentTo}</strong>. Open it to confirm your email, and you&apos;ll be logged in.
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Email" hint="Order updates are sent here." error={errors.email?.message}>
        {(p) => <Input type="email" autoComplete="email" {...p} {...form.register("email")} />}
      </Field>
      <Field label="Username" hint="Shown on your reviews. Letters, numbers and _ only." error={errors.username?.message}>
        {(p) => <Input autoComplete="username" {...p} {...form.register("username")} />}
      </Field>
      <Field label="Password" hint="At least 10 characters." error={errors.password?.message}>
        {(p) => <Input type="password" autoComplete="new-password" {...p} {...form.register("password")} />}
      </Field>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Creating your account…" : "Create account"}</Button>
      <p className="text-ink-soft">Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className={`${linkClass} text-ink`}>Log in</Link></p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const form = useForm<z.input<typeof forgotPasswordSchema>>({ resolver: formResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { submit, pending, message } = useActionForm(form, requestPasswordReset);
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Email" error={form.formState.errors.email?.message}>
        {(p) => <Input type="email" autoComplete="email" {...p} {...form.register("email")} />}
      </Field>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const form = useForm<z.input<typeof resetPasswordSchema>>({ resolver: formResolver(resetPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const { submit, pending, message } = useActionForm(form, updatePassword);
  const errors = form.formState.errors;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="New password" hint="At least 10 characters." error={errors.password?.message}>
        {(p) => <Input type="password" autoComplete="new-password" {...p} {...form.register("password")} />}
      </Field>
      <Field label="Type it again" error={errors.confirm?.message}>
        {(p) => <Input type="password" autoComplete="new-password" {...p} {...form.register("confirm")} />}
      </Field>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
    </form>
  );
}

export function LogOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button variant="secondary" size="sm" disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await signOut();
        window.location.assign(result.ok ? result.data.redirectTo : "/");
      }}>
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
