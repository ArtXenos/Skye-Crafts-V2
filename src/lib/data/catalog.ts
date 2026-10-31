import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";

// Public data, the same for every visitor, so it is cached ("use cache") and
// built into the static pages. Admin actions and checkout call updateTag()
// with these tags to refresh it immediately after a change.
export const TAGS = {
  products: "products",
  settings: "settings",
  reviews: "reviews",
} as const;

export type Product = {
  id: number;
  title: string;
  description: string;
  category: string;
  price_cents: number;
  stock: number;
  is_preorder: boolean;
  image_path: string | null;
};

const PRODUCT_COLUMNS = "id, title, description, category, price_cents, stock, is_preorder, image_path";

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.products);

  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true)
    .order("id");
  if (error) throw new Error(`Could not load products: ${error.message}`);
  return data;
}

export async function getProduct(id: number): Promise<Product | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.products);

  const { data, error } = await createPublicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`Could not load product ${id}: ${error.message}`);
  return data;
}

export type Review = {
  id: number;
  rating: number;
  body: string;
  created_at: string;
  username: string;
};

export async function getReviews(productId: number): Promise<Review[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.reviews);

  const { data, error } = await createPublicClient()
    .from("reviews")
    .select("id, rating, body, created_at, profiles(username)")
    .eq("product_id", productId)
    .order("id", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Could not load reviews: ${error.message}`);
  return data.map(({ profiles, ...review }) => ({ ...review, username: profiles?.username ?? "Customer" }));
}

export type RatingSummary = { average: number; count: number };

/** Average star rating per product id, for product cards. */
export async function getRatings(): Promise<Record<number, RatingSummary>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.reviews);

  const { data, error } = await createPublicClient().from("product_ratings").select("product_id, average, count");
  if (error) throw new Error(`Could not load ratings: ${error.message}`);
  return Object.fromEntries(
    data.flatMap(({ product_id, average, count }) =>
      product_id === null || average === null || count === null ? [] : [[product_id, { average, count }]],
    ),
  );
}

export type PublicSettings = Record<string, string>;

/** Settings anyone may see (the private ones are filtered out by the database). */
export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife("minutes");
  cacheTag(TAGS.settings);

  const { data, error } = await createPublicClient().from("shop_settings").select("key, value");
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return Object.fromEntries(data.map(({ key, value }) => [key, value]));
}
