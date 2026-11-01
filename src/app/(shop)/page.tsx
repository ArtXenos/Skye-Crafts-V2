import Link from "next/link";
import { WireDivider } from "@/components/shop/art";
import { HeroBouquet } from "@/components/shop/hero-bouquet";
import { Policies } from "@/components/shop/policies";
import { ProductCard } from "@/components/shop/product-card";
import { CustomRequestForm } from "@/components/shop/public-forms";
import { Button } from "@/components/ui/button";
import { getProducts, getPublicSettings, getRatings } from "@/lib/data/catalog";

const STEPS = [
  { title: "Tell us the idea", text: "Colours, size, occasion, and a reference photo if you have one." },
  { title: "Get a quote", text: "The shop replies with a price and how long it will take." },
  { title: "We shape it by hand", text: "Every stem and petal is bent, twisted and wrapped one at a time." },
  { title: "Pick up or get it delivered", text: "Collect it in person, or have it brought to your door nearby." },
];

export default async function HomePage() {
  const [products, ratings, settings] = await Promise.all([getProducts(), getRatings(), getPublicSettings()]);
  const featured = products.slice(0, 4);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div className="grid gap-6">
          <h1 className="text-[2.6rem] sm:text-6xl">Flowers that stay in bloom, twisted by hand from fuzzy wire.</h1>
          <p className="max-w-[34rem] text-lg text-ink-soft">
            Bouquets, keychains, little pots and figurines made to order in {settings.public_area || "the Philippines"}, for
            graduations, birthdays, monthsaries and everything in between.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/products">Shop the collection</Link></Button>
            <Button asChild size="lg" variant="secondary"><Link href="#custom">Request a custom piece</Link></Button>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <HeroBouquet />
        </div>
      </section>

      <section aria-labelledby="featured" className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 id="featured" className="text-3xl sm:text-4xl">Ready to gift</h2>
          <Button asChild variant="link"><Link href="/products">See every piece</Link></Button>
        </div>
        {featured.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} rating={ratings[product.id]} />
            ))}
          </div>
        ) : (
          <p className="text-ink-soft">New pieces are on the workbench. Check back soon, or request a custom one below.</p>
        )}
      </section>

      <WireDivider className="mx-auto my-20 max-w-6xl px-4" />

      <section id="custom" aria-labelledby="custom-heading" className="mx-auto grid max-w-6xl scroll-mt-24 gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="grid content-start gap-6">
          <h2 id="custom-heading" className="text-3xl sm:text-4xl">Something made just for them</h2>
          <p className="max-w-prose text-ink-soft">
            Match a bouquet to a uniform, recreate a pet as a figurine, or spell out a name in wire.
            Here is how a custom order goes:
          </p>
          <ol className="grid gap-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-bloom font-display text-lg text-ink">{index + 1}</span>
                <div>
                  <p className="font-semibold">{step.title}</p>
                  <p className="text-ink-soft">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-[var(--radius-tile)] bg-white p-6 ring-2 ring-line sm:p-8">
          <h3 className="mb-5 text-2xl">Request a custom piece</h3>
          <CustomRequestForm />
        </div>
      </section>

      <WireDivider className="mx-auto my-20 max-w-6xl px-4" />

      <section id="help" aria-labelledby="help-heading" className="mx-auto max-w-6xl scroll-mt-24 px-4 sm:px-6">
        <h2 id="help-heading" className="mb-10 text-3xl sm:text-4xl">Before you order</h2>
        <Policies settings={settings} />
      </section>
    </>
  );
}
