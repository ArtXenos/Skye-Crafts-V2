import type { PublicSettings } from "@/lib/data/catalog";

/** The shop's promises, written by the owner on the admin Settings page. */
export function Policies({ settings }: { settings: PublicSettings }) {
  const hours = settings.unpaid_order_hours || "48";
  const items = [
    {
      q: "How long does an order take?",
      a: `Ready pieces: ${settings.lead_time_ready}. Custom pieces: ${settings.lead_time_custom}.`,
    },
    {
      q: "How do I pay?",
      a: `Pay by GCash: the shop's GCash details appear on your order page right after you order. For pickup orders you can also pay cash when you collect. Orders that aren't paid or confirmed within ${hours} hours are cancelled automatically so the pieces go back on sale.`,
    },
    {
      q: "Delivery or pickup?",
      a: `${settings.shipping_note} Pickup is in ${settings.public_area}. ${settings.pickup_schedule} The exact pickup place is shown on your order page once the shop confirms your order.`,
    },
    { q: "Can I cancel?", a: settings.cancellation_note },
    { q: "What if something arrives damaged?", a: settings.damaged_note },
    { q: "How do refunds work?", a: settings.refund_note },
  ];

  return (
    <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.q} className="grid content-start gap-2 border-t-2 border-line pt-4">
          <dt className="font-display text-xl">{item.q}</dt>
          <dd className="max-w-prose text-ink-soft">{item.a}</dd>
        </div>
      ))}
    </dl>
  );
}
