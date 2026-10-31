import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { getPublicSettings, TAGS } from "@/lib/data/catalog";
import { NewsletterForm } from "./public-forms";

export async function SiteFooter() {
  "use cache"; // the same for everyone, so it is part of the static page
  cacheLife("days");
  cacheTag(TAGS.settings);
  const settings = await getPublicSettings();
  const socials = [
    { href: settings.facebook_url, label: "Facebook" },
    { href: settings.tiktok_url, label: "TikTok" },
  ].filter((item) => item.href);

  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1.4fr]">
        <div className="grid content-start gap-3">
          <p className="font-display text-3xl">Skye Crafts</p>
          <p className="max-w-xs text-paper/80">
            Fuzzy-wire bouquets and small gifts, shaped by hand in {settings.public_area || "the Philippines"}.
          </p>
        </div>
        <div className="grid content-start gap-2">
          <p className="font-semibold">Find us</p>
          {socials.map((item) => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="w-fit underline decoration-bloom underline-offset-4 hover:decoration-paper">
              {item.label}
            </a>
          ))}
          {settings.contact_phone && (
            <a href={`tel:${settings.contact_phone.replace(/[^0-9+]/g, "")}`} className="w-fit underline decoration-bloom underline-offset-4 hover:decoration-paper">
              {settings.contact_phone}
            </a>
          )}
          <Link href="/#help" className="w-fit underline decoration-bloom underline-offset-4 hover:decoration-paper">
            Ordering help and policies
          </Link>
        </div>
        <div className="rounded-[var(--radius-tile)] bg-paper p-5 text-ink">
          <NewsletterForm />
        </div>
      </div>
      <p className="border-t border-paper/15 px-4 py-5 text-center text-sm text-paper/70">
        © {new Date().getFullYear()} Skye Crafts. Made by hand in the Philippines.
      </p>
    </footer>
  );
}
