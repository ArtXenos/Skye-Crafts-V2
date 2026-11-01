# How Skye Crafts works

This is the guide to read before changing the code. It explains how the parts
connect, where each rule lives and why, and what Next.js 16 does differently
from older tutorials. File names are links you can open in your editor.

## 1. The big picture

```
 Browser (phone)                Vercel: Next.js                     Supabase
 ───────────────               ──────────────────                  ─────────────────────────
 pages, forms, cart  ──HTTP──▶ src/proxy.ts (refresh login)
 (cart in localStorage)        pages (Server Components) ──────▶  PostgREST  ─┐
                               Server Actions (form submits) ───▶  Auth        ├─▶ PostgreSQL
                                                              ───▶ Storage    ─┘   (tables, rules,
                                                                                    functions)
```

- The **browser never talks to Supabase**. Every read and write goes through the
  Next.js server, which talks to Supabase with the visitor's login cookie. That
  keeps the Content Security Policy simple (`connect-src 'self'`).
- **Supabase** gives three services over one URL: PostgREST (the database as an
  HTTP API), Auth (accounts and logins) and Storage (photos and receipts).

## 2. Where the rules live, and why there

Supabase's *publishable key* is public: it is in every visitor's browser
traffic by design. With it, **anyone can call PostgREST directly**, skipping
your pages and Server Actions entirely. So:

> **The database is the security boundary.** Every rule that matters is
> enforced in PostgreSQL. The Next.js code adds friendly messages on top.

Each rule is checked up to three times, for different reasons:

| Where | File | Why |
| --- | --- | --- |
| Browser | [`src/lib/validation.ts`](../src/lib/validation.ts) via react-hook-form | Instant feedback while typing. Trivially skipped by an attacker. |
| Server Action | [`src/app/actions/*.ts`](../src/app/actions) | Clear error messages next to the right field. Can be called directly, so it re-validates. |
| Database | [`supabase/migrations/`](../supabase/migrations) | The real enforcement. Can't be bypassed. |

The database uses three tools:

1. **CHECK constraints** ([`…100_schema.sql`](../supabase/migrations/20261027000100_schema.sql)): the *shape* of
   data. A price is 1 to 10,000,000 centavos, a status is one of seven words,
   `total = subtotal − discount`. No bug anywhere can store a row that breaks these.
2. **Row Level Security + GRANTs** ([`…200_security.sql`](../supabase/migrations/20261027000200_security.sql)): *who* sees
   and changes *which rows and columns*. Customers read only their own orders;
   `is_admin` can't be read or set by customers; private settings (GCash number,
   pickup address) are invisible in the settings table. Every customer-facing
   table starts from `revoke all`, then gets only the grants it needs.
3. **Functions** ([`…300_orders.sql`](../supabase/migrations/20261027000300_orders.sql)): operations with
   *business rules*. Nobody (not even an admin) may update `orders` directly; it
   only changes through `place_order`, `cancel_order`, `confirm_receipt`,
   `admin_set_order_status` and friends, each of which checks the caller and the
   current state inside one transaction.

These functions are `security definer` (they run with the owner's rights,
past RLS), so each one **checks the caller first** (`private.require_user()` or
`private.require_admin()`), and sets `search_path = ''` so nobody can trick it
by creating a table or function with the same name somewhere else.

### Error messages

Functions raise errors with `private.fail(kind, message)`: SQLSTATE `P0001`, a
message written for customers, and a *kind* in the error's `HINT`
(`invalid`, `auth`, `forbidden`, `not_found`, `conflict`, `limit`).
[`fromDatabaseError`](../src/lib/action-result.ts) shows P0001 messages as they are and replaces anything
else with a generic message (and logs the real one), so database internals
never reach a visitor.

## 3. One order, start to finish

1. **Cart.** "Add to cart" stores only `{productId, quantity}` in localStorage
   ([`src/lib/cart.ts`](../src/lib/cart.ts)). No prices: those are always read fresh from the server.
2. **Checkout page** ([`checkout/page.tsx`](../src/app/(shop)/checkout/page.tsx)) checks the login, then renders
   [`CheckoutForm`](../src/components/shop/checkout-form.tsx). The form makes a random **checkout key** when it opens.
3. **Apply coupon** calls `quoteCoupon` → `quote_coupon()` in the database. It
   prices the cart from the database and runs the same `private.coupon_discount`
   check that checkout uses, so the preview and the real charge can't disagree.
   Attempts are counted (20 per 5 minutes per account), and a successful check
   is remembered for an hour in `private.coupon_quotes`. Checkout only accepts a
   coupon the customer checked this way, so codes can't be guessed by calling
   `place_order` directly. (The checkout action runs the check for you if the
   customer typed a code without pressing Apply.)
4. **Place order** calls the `placeOrder` Server Action
   ([`actions/shop.ts`](../src/app/actions/shop.ts)), which validates the form, then:
   - calls `expire_stale_orders()` first, as a separate request, so stock held
     by overdue unpaid orders is released;
   - calls `place_order(...)`, which, in one transaction:
     1. takes a per-customer lock, so two clicks can't race the limits;
     2. validates every field again;
     3. if this checkout key was already used, returns that first order (a retry after a lost connection doesn't order twice);
     4. refuses a 4th unconfirmed order, or more than 10 orders an hour;
     5. locks the products **in id order** (`for update`) and checks stock, so two buyers can't both get the last piece; orders over ₱1,000,000 are refused (the subtotal is added up as `bigint`, so nothing can overflow);
     6. locks and re-checks the coupon, then counts the use;
     7. inserts the order, its items (with the price *as it was*) and the first history event, and reduces stock.
5. The action refreshes the cached catalogue (`updateTag("products")`, since
   stock changed), schedules the email with `after()` (sent after the response,
   never blocking it), and returns the order id. The browser empties the cart
   and opens the order page.
6. **Order page** ([`account/orders/[id]/page.tsx`](../src/app/(shop)/account/orders/[id]/page.tsx)) asks
   `order_private_details()` for what the customer needs *now*: GCash details
   while a GCash order waits for payment, and the pickup place **only once the
   shop has confirmed the order**. That stops someone from placing and
   cancelling an order just to learn the owner's address.
7. **Receipt upload** (`uploadReceipt`): the server checks the file's first
   bytes (a renamed text file isn't an image), uploads it to the private
   `receipts` bucket under `<user id>/…` (storage policies only allow your own
   folder), then `attach_receipt()` links it to the order.
8. **The owner** opens `/admin/orders/<id>`, sees the receipt through a
   10-minute signed link, and presses *Confirm order*:
   `admin_set_order_status()` checks the move is allowed
   (`private.can_transition`), records it in `order_events`, and on *Declined*
   or *Cancelled* returns the stock and the coupon use (`private.release_order`).
9. **Expiry.** An unconfirmed order without a receipt is cancelled after
   `unpaid_order_hours` (a setting, default 48) by `expire_stale_orders()`,
   which pg_cron runs every 10 minutes and the app also runs before each
   checkout and when the admin opens the orders list.

### Avoiding deadlocks

Locks are always taken in the same order: **orders → products (by id) →
coupons (by id)**. If two transactions take locks in opposite orders they can
wait for each other forever (Postgres then kills one). `expire_stale_orders`
takes all its locks up front for the same reason. The test
`does not deadlock when expiry runs during checkouts` checks this.

## 4. Next.js 16 things that differ from older tutorials

This app uses **Cache Components** (`cacheComponents: true` in
[`next.config.ts`](../next.config.ts)), the default for new Next.js 16 apps.

- **Static shell + streaming.** Each page is prerendered as far as possible.
  Anything that reads the visitor's cookies (their login) must sit inside a
  `<Suspense>` boundary and streams in afterwards. That's why pages such as
  [`account/page.tsx`](../src/app/(shop)/account/page.tsx) are a small sync component wrapping an async one in
  `<Suspense>`. Reading cookies outside one is a build error.
- **`"use cache"`** ([`src/lib/data/catalog.ts`](../src/lib/data/catalog.ts)): public data (products, reviews,
  public settings) is cached and shared by everyone. It uses a Supabase client
  **without cookies** (`createPublicClient`) so a cached result can never
  contain one person's data. Admin actions call `updateTag(...)` to refresh it
  immediately.
- **`proxy.ts`** is the new name for `middleware.ts`. Ours only refreshes the
  Supabase login cookie ([`src/lib/supabase/proxy.ts`](../src/lib/supabase/proxy.ts)); it is not an access check.
- **Hidden pages stay alive.** Next.js 16 keeps up to three recently visited
  pages mounted but hidden (React `<Activity>`), so going back is instant and
  keeps what you typed. That has consequences, all handled:
  - fixed `id`s would be duplicated by a hidden copy, so forms use `useId()`;
  - the checkout key is renewed after each order, or the next checkout on the
    kept-alive page would be treated as a retry of the last one;
  - login, sign-up and "add product/coupon" forms clear themselves when hidden;
  - after login, sign-up and logout the browser does a **full page load**, so
    nothing rendered for the logged-out visitor survives.

### Two smaller rules worth knowing

- **Stock on the product form.** Orders change stock constantly, so saving a
  product only writes `stock` if the owner edited that field, and only if the
  product hasn't changed since the form was opened (`updated_at` must match).
  Otherwise a price change could quietly undo sales.
- **Photos are capped at 4 MB**, because Vercel refuses requests over 4.5 MB.
  The browser checks the size before uploading, the server checks again, and
  the storage buckets enforce it too.

## 5. Security headers

Set in [`next.config.ts`](../next.config.ts): a Content Security Policy, `X-Frame-Options: DENY`
(no clickjacking), `nosniff`, a strict referrer policy, HSTS, and `noindex` on
`/admin`.

One honest trade-off: the CSP allows `'unsafe-inline'` scripts. Next.js puts
small inline scripts in prerendered pages, and the alternative (a per-request
nonce) would force every page to render on every request, losing the static
shell. React escapes everything it renders, and no page uses
`dangerouslySetInnerHTML`, which is what actually prevents script injection
here. The end-to-end tests check that a note containing `<b>` shows up as
text.

The CSP also allows images from `https://tile.openstreetmap.org`, for the
pickup map. The map is drawn with Leaflet in the browser
(`src/components/map/`), needs no API key, and gets its location the same way
as the address: `pickup_coordinates` is a private setting returned only by
`order_private_details`, once a pickup order is approved. A pin is more exact
than most addresses, so it must never become public. OpenStreetMap's tile
servers are free for light use like this; if the shop ever gets heavy traffic,
switch the tile URL in `leaflet-map.tsx` to a paid provider (MapTiler,
Stadia, Mapbox) and add that host to the CSP.

## 6. Deliberately not built (yet)

- **Online payment.** GCash is checked by the owner by eye; there's no payment
  gateway, so no card data ever touches the app.
- **Shipping fee calculation.** J&T fees are confirmed by message, as before.
- **Categories** are a fixed list (constraint + `src/lib/shop.ts`). Adding one
  means changing both, on purpose: it's rare and it affects the art and filters.
- **Deleting accounts.** Orders keep `buyer_id` (`on delete restrict`) so sales
  history can't vanish; deleting a customer is a manual job in Supabase.

### Known limits

Found in an independent review and left as they are, on purpose or for later:

- An order with a receipt never expires, so a fake receipt holds stock until
  the owner declines it. The admin dashboard counts "receipts to check" for this.
- Coupon attempts are limited per account; someone with many accounts gets more
  guesses. Accounts need a confirmed email, which slows this down.
- Orders cancelled automatically (expiry) don't send an email; the customer
  sees it on their order page.
- All logins reach Supabase from Vercel's servers, so Supabase's per-address
  login limits are shared. Watch for "too many attempts" errors as traffic grows.

## 7. From the Flask version

| Flask (v1) | Next.js + Supabase (v2) |
| --- | --- |
| `app.py`, 1,700 lines | Pages in `src/app`, actions in `src/app/actions`, rules in `supabase/migrations` |
| SQLite file | PostgreSQL (Supabase), with real row locks |
| Username + password, Flask session, CSRF token | Supabase Auth (email + password, confirmation, reset); Server Actions check the request's origin against your host |
| `require_user(admin=True)` in Python | `is_admin()` inside every policy and admin function |
| In-memory rate limits (lost per worker) | `private.rate_limits` table plus per-customer order limits in the database |
| HTML built from strings in `script.js` | React components; React escapes all text |
| Pickup address shown on any pickup order | Shown only after the shop confirms |
| Unpaid orders held stock forever | Expire after a set time and return stock |
| No product photos | Photos in Supabase Storage |

## 8. What the tests prove

- **`tests/db`** (Vitest against real PostgreSQL): each file clones a fresh
  database and acts as anonymous visitors, customers and admins, the way
  PostgREST does (`set role` + JWT claims). It covers who can read and write
  what, every checkout rule, coupons, the status machine, expiry, receipts,
  reviews, rate limits, and concurrent races.
- **`src/**/*.test.ts`**: money parsing and the form schemas.
- **`tests/e2e`** (Playwright, phone-sized Chromium): a guest shops, signs up at
  checkout, orders for pickup and by GCash, uploads a receipt; a customer is
  kept out of `/admin`; the owner confirms an order and the customer then sees
  the pickup place; a custom request is quoted; a product is added with a
  photo. Every page visited is scanned with axe for WCAG 2.1 AA problems.

## 9. Check your understanding

If you can answer these without looking, you understand the system:

1. A customer edits the page's JavaScript to send `price_cents: 1` at checkout. Why does nothing change?
2. Why does `place_order` lock products in id order?
3. Someone calls `update orders set status = 'Delivered'` through PostgREST with their own login. What stops them, and in which file?
4. Why is `submit_custom_request` callable only with the secret key, while `place_order` is callable by any logged-in customer?
5. What would break if `getProducts()` used `createClient()` (with cookies) instead of `createPublicClient()`?
6. A GCash order was placed 3 days ago, the receipt was uploaded, and the owner hasn't confirmed it. Will it expire? Why is that the right behaviour?
7. Why does the checkout form get a new checkout key after a successful order?
8. Where would you add a new setting, and which three files must change?
9. Why are failed coupon guesses returned as `{ok: false}` instead of raised as errors? (Hint: transactions.)
10. What does `safeNextPath` stop, and how could the login page be abused without it?
