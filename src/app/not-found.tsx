import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto grid max-w-xl gap-5 px-4 py-24">
      <p className="font-display text-6xl text-bloom">404</p>
      <h1 className="text-4xl">This page isn&apos;t here</h1>
      <p className="text-ink-soft">The piece may have sold out and been removed, or the link has a typo.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/products">Browse the collection</Link></Button>
        <Button asChild variant="secondary"><Link href="/">Go to the home page</Link></Button>
      </div>
    </main>
  );
}
