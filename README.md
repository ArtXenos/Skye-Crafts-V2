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
- Browse the collection by category (Flower Bouquets, Keychains, Fuzzy Wire Pots, Desk Figurines, Accessories), each listing its varieties; search; product pages with reviews.
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
- Order status emails, through Gmail (or any SMTP) or Resend.

## Run it on your computer (Windows, PowerShell)

You need [Node.js 22](https://nodejs.org) and, for a local database,
[Docker Desktop](https://www.docker.com/products/docker-desktop/).

```powershell
cd Skye-Crafts-V2
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

The live shop runs on **Vercel** (website) and **Supabase** (database), at a
free `vercel.app` address.

> **Plans.** Vercel's free *Hobby* plan is for non-commercial use only; a shop
> that sells needs **Vercel Pro**. Supabase's free plan allows a shop, but it
> keeps no downloadable backups (see [Backups](#backups)) and pauses after a
> week without activity (the daily keep-alive below prevents that).

### 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com). Pick the **Singapore** region, the closest to the Philippines.
2. Send the database setup to it:
   ```powershell
   npx supabase login
   npx supabase link --project-ref your-project-ref
   npx supabase db push
   ```
   The first time only, load the starter products: open **SQL Editor**, paste `supabase/seed.sql` and run it.
3. **Database → Extensions:** check that `pg_cron` is enabled. If it wasn't, enable it and run `npx supabase db push` again, or paste `supabase/migrations/20261027000400_storage_and_jobs.sql` into the SQL editor. It cancels overdue unpaid orders every 10 minutes.
4. **Authentication → URL Configuration:** set *Site URL* to your Vercel address (for example `https://skye-crafts-v2.vercel.app`) and add `https://skye-crafts-v2.vercel.app/**` to *Redirect URLs*.
5. **Authentication → Emails → Templates:** in *Confirm signup*, change the link's address to
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
   and in *Reset password* to
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`.
   (The app always sends a `RedirectTo` like `https://your-site/auth/confirm?next=/checkout`, so the
   customer lands back where they were.) These links work even when the email is opened on a different phone.
6. **Authentication → Emails → SMTP Settings:** Supabase's built-in sender only sends a few emails an hour, so
   sign-ups would fail once real customers arrive. Turn on custom SMTP with the Gmail details from
   [step 2](#2-an-email-account-for-sending) (host `smtp.gmail.com`, port `465`, your Gmail address as
   username and sender, the app password as password, sender name `Skye Crafts`).

### 2. An email account for sending

Without your own domain, the simplest sender is a Gmail account for the shop
(up to about 500 emails a day):

1. Create a Gmail account for the shop (for example `skyecrafts.shop@gmail.com`).
2. Turn on **2-Step Verification**: Google Account → Security.
3. Create an **app password**: Google Account → Security → App passwords → name it `Skye Crafts` → copy the 16 letters.
4. Use these in Supabase (step 1.6 above) and on Vercel (step 3.2 below).

If you buy a domain later, you can switch to [Resend](https://resend.com): verify the
domain there, set `RESEND_API_KEY`, use an address on that domain in `EMAIL_FROM`, and remove `SMTP_HOST`.

### 3. Vercel (website)

1. On [vercel.com](https://vercel.com), **Add New → Project** and import the GitHub repository.
2. **Settings → Environment Variables**, for *Production*:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *Publishable key* |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → *Secret key* |
   | `NEXT_PUBLIC_SITE_URL` | `https://skye-crafts-v2.vercel.app` (your address, no `/` at the end) |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | the shop's Gmail address |
   | `SMTP_PASS` | the 16-letter app password |
   | `EMAIL_FROM` | `Skye Crafts <the shop's Gmail address>` |
   | `CRON_SECRET` | a long random string (run `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`) |

3. **Deployments → Redeploy** (environment variables only apply to new deployments).
4. Sign up on the live site and make yourself admin with the SQL in [Run it on your computer](#run-it-on-your-computer-windows-powershell), in the hosted project's SQL Editor.
5. On `/admin/settings`, enter your GCash details, pickup place, policies and **Contact email** (shown on the Privacy page). For the map, tap the pickup spot on the map there, or paste the coordinates from Google Maps (long-press the place, then copy the numbers).
6. Read `/privacy` and `/terms` on the live site and check they match how you really run the shop.

`vercel.json` runs the website's server code in Singapore (`sin1`), next to the
database, and calls `/api/keepalive` once a day so Supabase doesn't pause.

### Updating the live site

1. Database changes first: `npx supabase db push` (it only sends new files in `supabase/migrations`).
2. Then push the code to `main` on GitHub. Vercel deploys it automatically. GitHub CI runs lint, types, unit and database tests; run `npm run build` and `npm run test:e2e` yourself first.

### Backups

```powershell
npm run db:backup
```

Saves the live database to `backups/<date>/` (needs Docker Desktop running and
the project linked, step 1.2). Run it every week and copy the folder somewhere
safe, such as a private Google Drive folder. It contains customers' personal data:
`backups/` is in `.gitignore`; never commit it. Product photos and receipts in
Supabase Storage are not included. To restore, run the three files in order
(`roles.sql`, `schema.sql`, `data.sql`) against an empty project with `psql`.

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
src/app/api/keepalive/ daily ping that keeps the free Supabase project awake
scripts/backup.mjs     npm run db:backup
src/lib/               shared logic: validation, money, data loading, Supabase clients
src/components/        UI pieces
tests/db/              database tests      tests/e2e/   browser tests
docs/ARCHITECTURE.md   how and why it works
```

After changing the database, regenerate the TypeScript types with `npm run db:types`.
