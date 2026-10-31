export default function Loading() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-16 sm:px-6 md:grid-cols-2" aria-busy="true">
      <div className="aspect-square animate-pulse rounded-[var(--radius-tile)] bg-petal" />
      <div className="grid content-start gap-4">
        <div className="h-12 w-3/4 animate-pulse rounded-full bg-petal" />
        <div className="h-8 w-1/3 animate-pulse rounded-full bg-petal" />
        <p className="sr-only">Loading this piece…</p>
      </div>
    </div>
  );
}
