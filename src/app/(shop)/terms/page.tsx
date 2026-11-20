import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, LegalPage, LegalSection } from "@/components/shop/legal-page";
import { getPublicSettings, TAGS } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Terms of Sale",
  description: "How ordering, payment, pickup, delivery, cancellations and refunds work at Skye Crafts.",
};

export default async function TermsPage() {
  "use cache"; // the same for everyone
  cacheLife("days");
  cacheTag(TAGS.settings);
  const settings = await getPublicSettings();
  const hours = settings.unpaid_order_hours || "48";
  const contact = <ContactLine email={settings.contact_email} phone={settings.contact_phone} facebook={settings.facebook_url} />;

  return (
    <LegalPage
      title="Terms of Sale"
      updated="20 November 2026"
      intro={
        <p>
          These terms apply when you order from Skye Crafts through this website. By placing an order or creating an
          account, you agree to them. They don&apos;t take away any rights you have under the Consumer Act of the
          Philippines.
        </p>
      }
    >
      <LegalSection title="The pieces">
        <p>
          Every piece is shaped by hand, so colours, sizes and details can differ a little from the photos. That is part
          of handmade work and not a defect. Made-to-order and custom pieces are made after your order is confirmed.
        </p>
      </LegalSection>

      <LegalSection title="Prices and orders">
        <p>
          Prices are in Philippine pesos (₱). The price you pay is the one shown at checkout. Placing an order is a request
          to buy: the shop confirms it, or declines it if a piece can&apos;t be made or supplied, in which case any payment
          is returned in full.
        </p>
        <p>
          Ready pieces: {settings.lead_time_ready}. Custom pieces: {settings.lead_time_custom}.
        </p>
      </LegalSection>

      <LegalSection title="Payment">
        <p>
          Pay by GCash using the details shown on your order page, then upload a screenshot of the payment. For pickup
          orders you can also pay cash when you collect. Orders that aren&apos;t paid or confirmed within {hours} hours are
          cancelled automatically, so the pieces go back on sale.
        </p>
      </LegalSection>

      <LegalSection title="Delivery and pickup">
        <p>
          {settings.shipping_note} Pickup is in {settings.public_area}. {settings.pickup_schedule} The exact pickup place is
          shown on your order page once the shop confirms your order.
        </p>
      </LegalSection>

      <LegalSection title="Cancellations, damage and refunds">
        <p><strong>Cancelling:</strong> {settings.cancellation_note}</p>
        <p><strong>Damaged pieces:</strong> {settings.damaged_note}</p>
        <p><strong>Refunds:</strong> {settings.refund_note}</p>
      </LegalSection>

      <LegalSection title="Custom requests">
        <p>
          A custom request is not an order until you accept the shop&apos;s quote. The shop may decline a request it
          can&apos;t make. Please don&apos;t send designs, logos or characters you don&apos;t have the right to use.
        </p>
      </LegalSection>

      <LegalSection title="Your account and reviews">
        <p>
          Keep your password to yourself; you are responsible for orders placed with your account. Reviews must be honest
          and about a piece you received. The shop may remove reviews that are offensive, unrelated or contain personal
          information, and may close accounts used for fake orders or abuse.
        </p>
      </LegalSection>

      <LegalSection title="Questions">
        <p>
          Contact us {contact}. How we handle your personal information is explained in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
