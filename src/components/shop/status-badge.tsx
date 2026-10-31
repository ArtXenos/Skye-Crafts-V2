import { customerStatusLabel } from "@/lib/shop";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  Placed: "bg-[#f6ecd6] text-[#6b4c12]",
  Approved: "bg-leaf-soft text-leaf",
  Packed: "bg-leaf-soft text-leaf",
  Shipped: "bg-leaf-soft text-leaf",
  Delivered: "bg-ink text-paper",
  Declined: "bg-alert-soft text-alert",
  Cancelled: "bg-[#eee6e9] text-ink-soft",
};

/** Order status as a small pill. `admin` shows the raw status name. */
export function StatusBadge({ status, fulfillment, admin = false }: { status: string; fulfillment: string; admin?: boolean }) {
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-sm font-semibold", TONE[status] ?? "bg-petal")}>
      {admin ? status : customerStatusLabel(status, fulfillment)}
    </span>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  const rounded = Math.round(rating);
  return (
    <span role="img" className={cn("text-wire", className)} aria-label={`${rating} out of 5 stars`}>
      <span aria-hidden="true">{"★".repeat(rounded)}</span>
      <span aria-hidden="true" className="text-line">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}
