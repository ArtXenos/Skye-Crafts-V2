"use client";

import type { ComponentProps, Ref } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./form";

/**
 * A password field with a button to show what was typed. Takes the same
 * props as Input (react-hook-form's register() included), and hides the
 * password again whenever its form is submitted.
 */
export function PasswordInput({ className, ref, ...props }: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  const own = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const form = own.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <div className="relative">
      <Input
        {...props}
        ref={(node) => {
          own.current = node;
          setRef(ref, node);
        }}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((shown) => !shown)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--radius-field)] text-ink-soft hover:text-ink"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
