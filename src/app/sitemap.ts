import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/data/catalog";
import { SITE_URL } from "@/lib/env";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProducts();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...products.map((product) => ({ url: `${SITE_URL}/products/${product.id}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
