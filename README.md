# Skye Crafts

An online shop for handmade fuzzy-wire bouquets, keychains, pots and figurines.
Customers browse, order for local delivery (within Governor Generoso, Davao Oriental) or pickup, pay by GCash or
cash on pickup, and follow their orders. The owner runs everything from
`/admin`.

This is version 2, rebuilt from the Flask + SQLite version with:

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions), TypeScript |
| Styling | Tailwind CSS 4, small shadcn-style components |
| Database, logins, file storage | Supabase (PostgreSQL, Auth, Storage) |
| Forms | zod (validation) + react-hook-form |
| Tests | Vitest (unit + database), Playwright (browser) |
| Hosting | Vercel (app) + Supabase (database) |

**How it fits together, and why, is explained in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).**
Read it before changing anything security-related.

## What it does

**Customers**
- Browse and search the collection; product pages with reviews.
- Cart kept in the browser, so they can shop before signing up.
- Checkout: delivery or pickup, GCash or cash on pickup, gift note, coupon.
- GCash orders show the shop's GCash details; the customer uploads a payment screenshot.
- Order page with status history; cancel until packed; confirm receipt.
- The pickup address, with a map pin and a "Get directions" link, is only shown after the shop confirms the order.
- Reviews, but only for pieces the customer actually received.
- Custom-piece requests (with or without an account) and a newsletter sign-up.
- Accounts with email confirmation and password reset.

**The owner (`/admin`)**
- Dashboard: orders waiting, receipts to check, 30-day sales, low stock, new requests.
- Orders: filter, search, paging; confirm, pack, ship, deliver, decline or cancel, with a note the customer sees.
- Products, each with a real photo: take it with the phone camera (or laptop webcam) or choose a saved one. Photos are shrunk on the device and their location data removed before upload.
- Download orders for Excel or Google Sheets (CSV): one row per order, or one row per piece sold, for any date range.
- Coupons, custom requests (with quotes), reviews, subscribers, and shop settings (GCash details, pickup place and map pin, delivery area, policies).

**Automatic**
- Stock goes down at checkout and back up on decline, cancel or expiry.
- Unconfirmed orders without a receipt are cancelled after 48 hours (adjustable), so nobody can hold stock with fake orders.
- Optional status emails through Resend.

## Run it on your computer (Windows, PowerShell)

You need [Node.js 22](https://nodejs.org) and, for a local database,
[Docker Desktop](https://www.docker.com/products/docker-desktop/).

```powershell
cd Skye-Crafts
npm install
Copy-Item .env.example .env.local

# Start a local Supabase (database, logins, storage) in Docker.
# It applies everything in supabase/migrations and supabase/seed.sql.
npx supabase start
```

`supabase start` prints an **API URL**, a **Publishable key** and a **Secret
key**. Put them in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Then:

```powershell
npm run dev
```

Open http://localhost:3000. Emails sent locally (sign-up, password reset)
appear in Mailpit, at the address `supabase start` printed.

**Make yourself the admin:** sign up on the site, then open Supabase Studio
(http://127.0.0.1:54323), go to SQL Editor and run:

```sql
update public.profiles set is_admin = true where username = 'your_username';
```

To start over with an empty database: `npx supabase db reset`.

## Put it online

### 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com) (the free plan is enough). Pick the Singapore region, the closest to the Philippines.
2. Send the database setup to it:
   ```powershell
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ```
   Then load the starter products once: open **SQL Editor**, paste `supabase/seed.sql` and run it.
3. **Database → Extensions:** check that `pg_cron` is enabled. If it wasn't, enable it and run `npx supabase db push` again, or paste `supabase/migrations/20261027000400_storage_and_jobs.sql` into the SQL editor. It cancels overdue unpaid orders every 10 minutes.
4. **Authentication → URL Configuration:** set *Site URL* to your Vercel address (for example `https://skye-crafts.vercel.app`) and add `https://skye-crafts.vercel.app/**` to *Redirect URLs*.
5. **Authentication → Emails → Templates:** in *Confirm signup*, change the link's address to
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   and in *Reset password* to
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`.
   (The app always sends a `RedirectTo` like `https://your-site/auth/confirm?next=/checkout`, so the
   customer lands back where they were.) These links work even when the email is opened on a different phone.
6. Supabase's built-in email sender is limited to a few emails an hour. Before real customers sign up, add your own SMTP under **Authentication → Emails → SMTP Settings** (Resend works for this too).

### 2. Vercel (website)

1. Push this repository to GitHub, then **Add New → Project** on [vercel.com](https://vercel.com) and import it.
2. Add the environment variables from `.env.example` (with your hosted Supabase values and `NEXT_PUBLIC_SITE_URL=https://your-address.vercel.app`).
3. Deploy. Sign up on the live site and make yourself admin with the SQL above (in the hosted project's SQL Editor).
4. On `/admin/settings`, enter your GCash details, pickup place and policies. For the map, tap the pickup spot on the map there, or paste the coordinates from Google Maps (long-press the place, then copy the numbers).

## Tests

```powershell
npm test            # unit tests (validation, money)
npm run test:db     # 100 database tests: security rules, checkout, coupons, races
npm run test:e2e    # browser tests: shopping, checkout, admin, accessibility
npm run typecheck
npm run lint
```

`test:db` needs a PostgreSQL server (the one from `npx supabase start` works:
it is the default `TEST_DATABASE_URL`). Each test file gets its own throwaway
database, so it never touches your data.

GitHub runs lint, types, unit and database tests on every push
(`.github/workflows/ci.yml`).

`test:e2e` needs the app running against a local Supabase (`npm run build`,
then the tests start the server). It creates test accounts and orders, so
only run it against a local database, never the live one.

## Folder guide

```
supabase/migrations/   the database: tables, security rules, checkout logic
supabase/seed.sql      starter products
src/app/(shop)/        customer pages
src/app/admin/         owner pages
src/app/actions/       Server Actions (what forms call)
src/lib/               shared logic: validation, money, data loading, Supabase clients
src/components/        UI pieces
tests/db/              database tests      tests/e2e/   browser tests
docs/ARCHITECTURE.md   how and why it works
```

After changing the database, regenerate the TypeScript types with `npm run db:types`.
