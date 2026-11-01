import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[var(--radius-field)] border-2 border-line bg-white px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-soft/80 transition-colors hover:border-bloom focus-visible:border-ink focus-visible:outline-none aria-invalid:border-alert disabled:bg-petal/50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 appearance-none bg-[length:12px] bg-[right_0.9rem_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a2230' stroke-width='2' fill='none'/%3E%3C/svg%3E\")" }}
      {...props}>
      {children}
    </select>
  );
}

/**
 * A labelled form field with hint and error text wired up for screen
 * readers. `children` receives the id and aria attributes to spread on the
 * control.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (control: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-ink-soft"> (optional)</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && <p id={hintId} className="text-sm text-ink-soft">{hint}</p>}
      {error && <p id={errorId} className="text-sm font-medium text-alert">{error}</p>}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-[0.95rem]", className)}>
      <input type="checkbox" className="mt-1 size-4 accent-ink" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** A message box for the result of a form (error or success). */
export function Notice({ tone = "info", children, className, id }: { tone?: "info" | "error" | "success"; children: ReactNode; className?: string; id?: string }) {
  if (!children) return null;
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-field)] px-4 py-3 text-[0.95rem]",
        tone === "error" && "bg-alert-soft text-alert",
        tone === "success" && "bg-leaf-soft text-leaf",
        tone === "info" && "bg-petal text-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}
