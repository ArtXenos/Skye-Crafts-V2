"use client";

import { Button } from "@/components/ui/button";

// Shown when a page fails to load (for example the database is unreachable).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto grid max-w-xl gap-5 px-4 py-24">
      <h1 className="text-4xl">This page didn&apos;t load</h1>
      <p className="text-ink-soft">Something went wrong on our side. Your cart is safe. Try again in a moment.</p>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
