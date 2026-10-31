import type { ReactNode } from "react";

/** A narrow, centred card for the log-in and account pages. */
export function AuthShell({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 pt-12">
      <h1 className="mb-2 text-4xl">{title}</h1>
      {intro && <p className="mb-8 text-ink-soft">{intro}</p>}
      <div className="rounded-[var(--radius-tile)] bg-white p-6 ring-2 ring-line sm:p-8">{children}</div>
    </div>
  );
}
