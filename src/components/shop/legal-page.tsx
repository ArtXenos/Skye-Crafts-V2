import Link from "next/link";
import type { ReactNode } from "react";

/** Layout for the Privacy and Terms pages: a readable column of sections. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="mx-auto grid max-w-3xl gap-10 px-4 pt-12 sm:px-6">
      <header className="grid gap-3">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        <p className="text-sm text-ink-soft">Last updated {updated}</p>
        <div className="max-w-prose text-lg text-ink-soft">{intro}</div>
      </header>
      {children}
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t-2 border-line pt-6">
      <h2 className="text-2xl">{title}</h2>
      <div className="grid max-w-prose gap-3 text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:decoration-bloom-deep [&_a]:underline-offset-4 [&_a]:[overflow-wrap:anywhere] [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

/** A link to another website, which opens in a new tab and says so. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

type Contacts = { email?: string; phone?: string; facebook?: string; tiktok?: string };

/**
 * How to reach the shop, from the owner's settings, worded to follow
 * "contact us": "by email at …, by text or call on … or on our Facebook page".
 */
export function ContactLine({ email, phone, facebook, tiktok }: Contacts) {
  const ways: ReactNode[] = [];
  if (email) ways.push(<>by email at <a href={`mailto:${email}`}>{email}</a></>);
  if (phone) ways.push(<>by text or call on <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a></>);
  if (facebook) ways.push(<>on our <ExternalLink href={facebook}>Facebook page</ExternalLink></>);
  if (tiktok) ways.push(<>on <ExternalLink href={tiktok}>TikTok</ExternalLink></>);
  // Always a way that works: the request form on the home page needs no account.
  if (ways.length === 0) return <>by sending a message through the <Link href="/#custom">request form on our home page</Link></>;
  return (
    <>
      {ways.map((way, index) => (
        <span key={index}>
          {index > 0 && (index === ways.length - 1 ? " or " : ", ")}
          {way}
        </span>
      ))}
    </>
  );
}
