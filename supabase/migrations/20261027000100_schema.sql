-- Skye Crafts: tables and constraints.
--
-- Rules about the *shape* of data (lengths, allowed values, money never
-- negative) live here as CHECK constraints, so no client, script or bug can
-- store a bad row. Rules about *who* may do what live in
-- 20261027000200_security.sql; business operations (checkout, cancelling,
-- status changes) live in 20261027000300_orders.sql.
--
-- Money is stored in centavos (integer), never as floating point.

create schema if not exists private;  -- internal helpers, not exposed by the API
revoke all on schema private from public;

-- Keeps updated_at current on every UPDATE.
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- profiles: one row per account (auth.users holds the email and password) --

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

-- Create the profile when someone signs up. The username comes from the
-- sign-up form (user metadata); if it is missing, invalid or already taken,
-- a generated one is used so that sign-up itself never fails here.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := new.raw_user_meta_data ->> 'username';
  fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);
begin
  if wanted is null
     or wanted !~ '^[A-Za-z0-9_]{3,30}$'
     or exists (select 1 from public.profiles where lower(username) = lower(wanted)) then
    wanted := fallback;
  end if;
  insert into public.profiles (id, username) values (new.id, wanted);
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- products -------------------------------------------------------------------

create table public.products (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 100),
  description text not null check (char_length(description) between 1 and 1000),
  category text not null
    check (category in ('Bouquets', 'Keychains', 'Pots', 'Figurines')),
  price_cents integer not null check (price_cents between 1 and 10000000),
  -- Ignored for pre-order items, which have no stock limit.
  stock integer not null default 0 check (stock between 0 and 100000),
  is_preorder boolean not null default false,
  is_active boolean not null default true,
  -- Path inside the "product-images" storage bucket.
  image_path text check (image_path is null or char_length(image_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

-- coupons --------------------------------------------------------------------

create table public.coupons (
  id bigint generated always as identity primary key,
  -- Always stored in upper case; customers can type it in any case.
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,40}$'),
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  -- A percentage (1-100) or an amount in centavos.
  discount_value integer not null check (discount_value > 0),
  max_discount_cents integer not null default 0 check (max_discount_cents >= 0),  -- 0 = no cap
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  max_uses integer not null default 0 check (max_uses >= 0),  -- 0 = unlimited
  used_count integer not null default 0 check (used_count >= 0),
  once_per_customer boolean not null default true,
  -- Calendar days in the shop's time zone (Asia/Manila), inclusive.
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (discount_type <> 'percentage' or discount_value <= 100),
  -- Keep amounts sensible: at most ₱100,000 off, minimum order up to ₱1,000,000.
  check (discount_value <= 10000000 and max_discount_cents <= 10000000 and min_order_cents <= 100000000)
);

-- orders ---------------------------------------------------------------------

create table public.orders (
  id bigint generated always as identity primary key,
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  -- Copied from the account at checkout, for status emails.
  buyer_email text not null default '',
  recipient text not null check (char_length(recipient) between 2 and 80),
  contact text not null check (char_length(contact) between 7 and 40),
  fulfillment text not null check (fulfillment in ('delivery', 'pickup')),
  address text not null default '' check (char_length(address) <= 500),
  payment_method text not null check (payment_method in ('gcash', 'cash_on_pickup')),
  -- Gift message, colour request and so on.
  note text not null default '' check (char_length(note) <= 300),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  coupon_id bigint references public.coupons (id) on delete set null,
  coupon_code text not null default '',
  -- Sent by the browser with each checkout attempt. A retry with the same key
  -- returns the first order instead of placing a second one.
  checkout_key text check (checkout_key is null or checkout_key ~ '^[A-Za-z0-9-]{16,64}$'),
  cart_fingerprint text not null default '',
  status text not null default 'Placed' check (status in (
    'Placed', 'Approved', 'Packed', 'Shipped', 'Delivered', 'Declined', 'Cancelled'
  )),
  -- Latest note from the shop (for example a reason for declining).
  status_note text not null default '' check (char_length(status_note) <= 300),
  -- Path inside the private "receipts" bucket (GCash payment screenshot).
  receipt_path text check (receipt_path is null or char_length(receipt_path) <= 300),
  -- Unapproved orders without a receipt are cancelled after this time and
  -- their stock is returned (see private.expire_stale_orders).
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fulfillment = 'pickup' or char_length(address) >= 10),
  check (payment_method = 'gcash' or fulfillment = 'pickup'),
  check (total_cents = subtotal_cents - discount_cents),
  unique (buyer_id, checkout_key)
);
create index orders_buyer on public.orders (buyer_id, id desc);
create index orders_status on public.orders (status, id desc);
create index orders_expiry on public.orders (expires_at) where status = 'Placed';
create index orders_coupon on public.orders (coupon_id);
create trigger orders_touch before update on public.orders
  for each row execute function private.touch_updated_at();

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  -- Kept even if the product is later deleted; title and price are snapshots.
  product_id bigint references public.products (id) on delete set null,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  quantity integer not null check (quantity between 1 and 99),
  is_preorder boolean not null default false
);
create index order_items_order on public.order_items (order_id);
create index order_items_product on public.order_items (product_id);

-- Every status change, with who made it. Customers see the actor as
-- "customer", "shop" or "system"; only admins see which admin account.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  status text not null,
  note text not null default '',
  actor text not null check (actor in ('customer', 'shop', 'system')),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order on public.order_events (order_id, id);

-- reviews --------------------------------------------------------------------

create table public.reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)  -- one review per customer per product
);
create index reviews_product on public.reviews (product_id, id desc);
create trigger reviews_touch before update on public.reviews
  for each row execute function private.touch_updated_at();

-- custom order requests ------------------------------------------------------

create table public.custom_requests (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,  -- null = guest
  name text not null check (char_length(name) between 2 and 80),
  contact text not null check (char_length(contact) between 5 and 120),
  occasion text not null default '' check (char_length(occasion) <= 100),
  details text not null check (char_length(details) between 10 and 2000),
  status text not null default 'New'
    check (status in ('New', 'Quoted', 'In progress', 'Completed', 'Declined')),
  quote_cents integer check (quote_cents is null or quote_cents between 1 and 10000000),
  -- Message from the shop, shown to the customer (if they have an account).
  shop_note text not null default '' check (char_length(shop_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index custom_requests_user on public.custom_requests (user_id);
create trigger custom_requests_touch before update on public.custom_requests
  for each row execute function private.touch_updated_at();

-- newsletter -----------------------------------------------------------------

create table public.newsletter_subscribers (
  id bigint generated always as identity primary key,
  email text not null unique
    check (char_length(email) <= 254
           and email = lower(email)
           and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

-- shop settings (editable by the owner on the admin page) ------------------

create table public.shop_settings (
  key text primary key check (key in (
    'pickup_location', 'pickup_schedule', 'public_area',
    'gcash_name', 'gcash_number',
    'shipping_note', 'lead_time_ready', 'lead_time_custom',
    'cancellation_note', 'damaged_note', 'refund_note',
    'unpaid_order_hours', 'low_stock_threshold',
    'facebook_url', 'tiktok_url', 'contact_phone'
  )),
  value text not null,
  -- Private settings are only shown to a customer inside their own order,
  -- and only at the step where they need them (see order_private_details).
  is_private boolean not null default false,
  updated_at timestamptz not null default now(),
  check (char_length(value) <= case key
    when 'pickup_location' then 1000
    when 'pickup_schedule' then 1000
    when 'gcash_number' then 30
    when 'gcash_name' then 80
    when 'public_area' then 120
    when 'lead_time_ready' then 120
    when 'lead_time_custom' then 120
    when 'unpaid_order_hours' then 3
    when 'low_stock_threshold' then 4
    when 'contact_phone' then 30
    when 'facebook_url' then 300
    when 'tiktok_url' then 300
    else 400 end),
  -- 1 to 168 hours (one week).
  check (key <> 'unpaid_order_hours' or value ~ '^([1-9][0-9]?|1[0-5][0-9]|16[0-8])$'),
  check (key <> 'low_stock_threshold' or value ~ '^[0-9]{1,4}$'),
  check (key not in ('facebook_url', 'tiktok_url') or value = '' or value ~ '^https://[^\s<>"]+$')
);
create trigger shop_settings_touch before update on public.shop_settings
  for each row execute function private.touch_updated_at();

-- Neutral defaults. The real pickup place and GCash details are entered on
-- the admin Settings page, never in source code.
insert into public.shop_settings (key, value, is_private) values
  ('pickup_location', 'Ask the shop for the pickup location.', true),
  ('pickup_schedule', 'Pickup times are arranged with you by message.', false),
  ('public_area', 'the Philippines', false),
  ('gcash_name', '', true),
  ('gcash_number', '', true),
  ('shipping_note', 'Shipping is paid by the customer through J&T Express. The fee is confirmed by message before payment.', false),
  ('lead_time_ready', '1-3 days after payment is confirmed', false),
  ('lead_time_custom', 'Stated in your quotation', false),
  ('cancellation_note', 'You can cancel until your order is packed. Custom pieces cannot be cancelled once crafting begins.', false),
  ('damaged_note', 'Message us within 48 hours of receiving your order with your order number and photos. We will offer a replacement or refund.', false),
  ('refund_note', 'Approved refunds are returned manually through the same payment method.', false),
  ('unpaid_order_hours', '48', false),
  ('low_stock_threshold', '3', false),
  ('facebook_url', '', false),
  ('tiktok_url', '', false),
  ('contact_phone', '', false);

-- Coupons a customer has successfully checked with the "Apply" button
-- (quote_coupon). Checkout only accepts a coupon quoted in the last hour, so
-- guessing codes must go through quote_coupon, which counts attempts.
create table private.coupon_quotes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  coupon_id bigint not null references public.coupons (id) on delete cascade,
  quoted_at timestamptz not null default now(),
  primary key (user_id, coupon_id)
);

-- Average rating per product, for product cards. A view so the database does
-- the counting (instead of sending every review to the app).
create view public.product_ratings with (security_invoker = true) as
  select product_id,
         round(avg(rating)::numeric, 1)::float8 as average,
         count(*)::integer as count
  from public.reviews
  group by product_id;

-- rate limits (database-backed, so they work across serverless instances) -

create table private.rate_limits (
  bucket text not null,
  key text not null,          -- a SHA-256 hash, never a raw IP address
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key, window_start)
);
