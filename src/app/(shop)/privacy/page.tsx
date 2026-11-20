import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine, ExternalLink, LegalPage, LegalSection } from "@/components/shop/legal-page";
import { getPublicSettings, TAGS } from "@/lib/data/catalog";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What personal information Skye Crafts collects, why, and your rights under the Data Privacy Act of 2012.",
};

export default async function PrivacyPage() {
  "use cache"; // the same for everyone
  cacheLife("days");
  cacheTag(TAGS.settings);
  const settings = await getPublicSettings();
  const contact = (
    <ContactLine email={settings.contact_email} phone={settings.contact_phone} facebook={settings.facebook_url} tiktok={settings.tiktok_url} />
  );

  return (
    <LegalPage
      title="Privacy Policy"
      updated="20 November 2026"
      intro={
        <p>
          Skye Crafts is a small handmade-gift shop in {settings.public_area || "the Philippines"}. This page explains what
          personal information we collect when you use this website, why we need it, and the rights you have under the
          Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>
      }
    >
      <LegalSection title="What we collect">
        <ul className="grid gap-2">
          <li><strong>Your account:</strong> email address, username and password. Passwords are stored scrambled (hashed); nobody at the shop can read them.</li>
          <li><strong>Your orders:</strong> the recipient&apos;s name, mobile number, delivery address (for delivery orders), notes you add, what you bought and how you chose to pay.</li>
          <li><strong>GCash payment screenshots</strong> you upload, so the shop can check your payment.</li>
          <li><strong>Custom-piece requests:</strong> your name, how to contact you, and the details of your idea.</li>
          <li><strong>Reviews</strong> you write. They are shown publicly with your username.</li>
          <li><strong>Newsletter:</strong> your email address, if you sign up.</li>
        </ul>
        <p>
          We don&apos;t collect card details: this site takes no card payments. We don&apos;t use advertising or tracking
          cookies, and we don&apos;t sell or rent your information to anyone.
        </p>
      </LegalSection>

      <LegalSection title="Why we use it">
        <ul className="grid gap-2">
          <li>To make, deliver or hand over your order, and to contact you about it.</li>
          <li>To check your payment and keep records of sales.</li>
          <li>To reply to custom requests with a quote.</li>
          <li>To send order updates by email and, only if you signed up, occasional shop news.</li>
          <li>To keep the shop safe, for example by limiting repeated attempts on forms.</li>
        </ul>
        <p>
          We use your information because you asked us to fulfil an order or request, because the law requires us to keep
          sales records, or because you agreed to it (the newsletter).
        </p>
      </LegalSection>

      <LegalSection title="Cookies and your browser">
        <p>
          When you log in, the site sets a cookie that keeps you logged in. Your cart is kept in your own browser
          (local storage), not on our servers, until you place an order. Neither is used to track you on other sites.
        </p>
        <p>
          To limit abuse of the public forms, the site keeps a one-way scrambled code made from your network address, for
          two days. The address can&apos;t be worked out from the code.
        </p>
        <p>
          Like most websites, our hosting and database providers keep short-lived technical logs, including network
          addresses, to keep the service secure and working.
        </p>
      </LegalSection>

      <LegalSection title="Who else handles it">
        <p>We use a few trusted services to run this website. They only process information on our behalf:</p>
        <ul className="grid gap-2">
          <li><strong>Supabase</strong>: stores the shop&apos;s database, accounts and uploaded photos, on servers in Singapore.</li>
          <li><strong>Vercel</strong>: hosts the website.</li>
          <li><strong>Google (Gmail)</strong>: sends account and order emails.</li>
          <li><strong>OpenStreetMap</strong>: shows the pickup map on confirmed pickup orders. Your browser loads map pictures from it.</li>
        </ul>
        <p>
          Some of these providers handle information outside the Philippines. We choose providers that keep it secure, and
          we stay responsible for your information wherever it is handled.
        </p>
        <p>
          The exact pickup place and the shop&apos;s GCash details are only shown on your own order. We share your name,
          number and address only with the person delivering your order. We may also disclose information when the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Order records are kept for as long as we must keep sales and tax records under Philippine law. Payment screenshots,
          requests and newsletter sign-ups are kept only while they are useful to the shop, and you may ask us to remove them
          sooner. If you ask us to close your account, we delete your details except what the law requires us to keep.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under the Data Privacy Act, you have the right to:</p>
        <ul className="grid gap-2">
          <li>be told how your information is used (this page);</li>
          <li>see the information we hold about you and get a copy of it;</li>
          <li>have wrong or out-of-date information corrected;</li>
          <li>object to its use, withdraw your consent (for example, ask us to take you off the newsletter) or ask us to delete it, except what the law requires us to keep;</li>
          <li>complain to the <ExternalLink href="https://privacy.gov.ph">National Privacy Commission</ExternalLink> if you think your information was mishandled.</li>
        </ul>
        <p>To use any of these rights, contact us {contact}. We may ask you to confirm who you are first, so nobody else can get your information.</p>
      </LegalSection>

      <LegalSection title="Keeping it safe">
        <p>
          The site only works over a secure (HTTPS) connection. Your orders, requests and screenshots can only be seen by you
          and the shop owner. If a breach ever puts your information at risk, we will tell you and the National Privacy
          Commission as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If we change this policy, we will update the date at the top of this page. Questions about your privacy? Contact
          us {contact}. See also our <Link href="/terms">Terms of Sale</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
