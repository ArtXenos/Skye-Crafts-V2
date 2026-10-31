import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

// Fonts are bundled with the app (no request to Google at runtime).
const caprasimo = localFont({
  src: "./fonts/Caprasimo-Regular.woff2",
  weight: "400",
  variable: "--font-caprasimo",
  display: "swap",
});

const figtree = localFont({
  src: [
    { path: "./fonts/Figtree-Variable.woff2", style: "normal", weight: "300 900" },
    { path: "./fonts/Figtree-Variable-Italic.woff2", style: "italic", weight: "300 900" },
  ],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Skye Crafts: handmade fuzzy-wire bouquets and gifts",
    template: "%s | Skye Crafts",
  },
  description:
    "Handmade fuzzy-wire bouquets, keychains, pots and figurines, made to order in the Philippines. Order a ready piece or request a custom gift.",
  openGraph: {
    type: "website",
    siteName: "Skye Crafts",
    locale: "en_PH",
  },
};

export const viewport: Viewport = {
  themeColor: "#fff9fa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${caprasimo.variable} ${figtree.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{ className: "!rounded-2xl !border-line !bg-white !text-ink !font-sans" }}
        />
      </body>
    </html>
  );
}
