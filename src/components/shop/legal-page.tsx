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
      <div className="grid max-w-prose gap-3 text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:decoration-bloom [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
        {children}
      </div>
    </section>
  );
}

/** How to reach the shop, from the owner's settings. */
export function ContactLine({ email, phone, facebook }: { email?: string; phone?: string; facebook?: string }) {
  const ways: ReactNode[] = [];
  if (email) ways.push(<a key="email" href={`mailto:${email}`}>{email}</a>);
  if (phone) ways.push(<a key="phone" href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>);
  if (facebook) ways.push(<a key="fb" href={facebook} target="_blank" rel="noopener noreferrer">our Facebook page</a>);
  if (ways.length === 0) return <>through the contact details in the footer of this site</>;
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
