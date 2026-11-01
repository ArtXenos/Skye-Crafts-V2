import Image from "next/image";
import { productImageUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

// Until the shop uploads photos, each category gets a simple wire drawing on
// its own soft tint. Plum strokes with round caps read as bent chenille stems.

const TINTS: Record<string, string> = {
  "Flower Bouquets": "bg-petal",
  Keychains: "bg-[#f6ecd6]",
  "Fuzzy Wire Pots": "bg-leaf-soft",
  "Desk Figurines": "bg-[#efe3f1]",
  Accessories: "bg-[#e6eef6]",
};

function Glyph({ category }: { category: string }) {
  const stroke = { stroke: "var(--color-ink)", strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (category) {
    case "Keychains":
      return (
        <g>
          <circle cx="100" cy="58" r="20" {...stroke} />
          <path d="M100 78 C 100 96, 104 104, 100 118" {...stroke} />
          <circle cx="100" cy="140" r="22" fill="var(--color-bloom)" />
          <circle cx="100" cy="140" r="9" fill="#f6d9e0" />
        </g>
      );
    case "Fuzzy Wire Pots":
      return (
        <g>
          <path d="M100 118 C 96 96, 112 84, 100 64 C 90 48, 108 40, 100 30" {...stroke} stroke="var(--color-leaf)" />
          <circle cx="100" cy="30" r="13" fill="var(--color-bloom)" />
          <path d="M66 118 H134 L124 166 H76 Z" {...stroke} fill="#f6d9e0" />
        </g>
      );
    case "Accessories":
      // A beaded bracelet with a flower charm.
      return (
        <g>
          <ellipse cx="100" cy="100" rx="52" ry="40" {...stroke} stroke="var(--color-wire)" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <circle key={i} cx={100 + 52 * Math.cos((i * Math.PI) / 5)} cy={100 + 40 * Math.sin((i * Math.PI) / 5)} r="7"
              fill={i % 2 ? "var(--color-bloom)" : "#f6d9e0"} />
          ))}
          <circle cx="100" cy="152" r="14" fill="var(--color-bloom-deep)" />
          <circle cx="100" cy="152" r="5" fill="#f6d9e0" />
        </g>
      );
    case "Desk Figurines":
      return (
        <g>
          <circle cx="100" cy="72" r="26" {...stroke} fill="#f6d9e0" />
          <path d="M70 160 C 70 120, 130 120, 130 160" {...stroke} fill="var(--color-bloom)" />
          <path d="M80 50 C 76 36, 88 34, 90 48 M120 50 C 124 36, 112 34, 110 48" {...stroke} />
        </g>
      );
    default:
      return (
        <g>
          <path d="M100 168 C 96 130, 70 110, 64 72" {...stroke} stroke="var(--color-leaf)" />
          <path d="M100 168 C 100 120, 100 96, 100 56" {...stroke} stroke="var(--color-leaf)" />
          <path d="M100 168 C 104 130, 130 110, 136 76" {...stroke} stroke="var(--color-leaf)" />
          <circle cx="64" cy="66" r="17" fill="var(--color-bloom)" />
          <circle cx="100" cy="48" r="20" fill="var(--color-bloom-deep)" />
          <circle cx="136" cy="70" r="16" fill="#f6d9e0" stroke="var(--color-bloom)" strokeWidth="4" />
          <path d="M80 160 Q100 176 120 160" {...stroke} stroke="var(--color-wire)" />
        </g>
      );
  }
}

/** A product's photo if it has one, otherwise its category drawing. */
export function ProductArt({
  title,
  category,
  imagePath,
  className,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw",
  priority = false,
}: {
  title: string;
  category: string;
  imagePath: string | null;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const url = productImageUrl(imagePath);
  return (
    <div className={cn("relative aspect-square overflow-hidden rounded-[var(--radius-tile)]", TINTS[category] ?? "bg-petal", className)}>
      {url ? (
        <Image src={url} alt={title} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <svg viewBox="0 0 200 200" role="img" aria-label={`${category} illustration`} className="absolute inset-0 size-full p-[12%]">
          <Glyph category={category} />
        </svg>
      )}
    </div>
  );
}

/** A length of twisted wire, used to separate the big sections of a page. */
export function WireDivider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true" className={cn("h-5 w-full text-bloom", className)}>
      <path
        d="M2 12 C 30 2, 50 22, 78 12 S 126 2, 154 12 S 202 22, 230 12 S 278 2, 306 12 S 354 22, 382 12 S 430 2, 458 12 S 506 22, 534 12 S 582 2, 598 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
