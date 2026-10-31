-- Skye Crafts: who may read and change what (Row Level Security).
--
-- Supabase exposes every table in the "public" schema through its REST API,
-- and the anon key that reaches it is public (it ships to every browser).
-- So these policies, not the Next.js code, are what actually protect data:
-- anything allowed here can be done by anyone with a terminal.
--
-- Pattern used throughout:
--   * Table privileges (GRANT) say which roles may attempt an operation and
--     on which columns.
--   * RLS policies say which rows.
--   * Writes that need business rules (checkout, cancelling, status changes,
--     reviews) are not granted at all; they go through the functions in the
--     next migration, which check everything inside one transaction.
--
-- `(select auth.uid())` and `(select public.is_admin())` are wrapped in a
-- sub-select so Postgres evaluates them once per query instead of per row.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select is_admin from public.profiles where id = (select auth.uid())),
    false
  )
$$;

-- Start from nothing: Supabase's defaults grant everything on new tables to
-- anon and authenticated. Each grant below is deliberate.
revoke all on all tables in schema public from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.reviews enable row level security;
alter table public.custom_requests enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.shop_settings enable row level security;
alter table private.rate_limits enable row level security;
alter table private.coupon_quotes enable row level security;

-- profiles: usernames are public (they appear on reviews); is_admin is not.
grant select (id, username, created_at) on public.profiles to anon, authenticated;
grant update (username) on public.profiles to authenticated;
create policy "profiles are readable" on public.profiles
  for select to anon, authenticated using (true);
create policy "users rename themselves" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- products: everyone sees active products; admins see and edit all.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
create policy "active products are public" on public.products
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy "admins add products" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins edit products" on public.products
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete products" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- coupons: admins only. Customers check a code through quote_coupon(), which
-- never reveals other codes.
grant select, insert, update, delete on public.coupons to authenticated;
create policy "admins manage coupons" on public.coupons
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- orders: read your own (admins read all). No direct writes for anyone.
grant select on public.orders to authenticated;
create policy "read own orders" on public.orders
  for select to authenticated
  using (buyer_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.order_items to authenticated;
create policy "read items of visible orders" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id));

-- Not actor_id: which admin account made a change stays private
-- (customers see "shop"; admins use admin_order_events()).
grant select (id, order_id, status, note, actor, created_at) on public.order_events to authenticated;
create policy "read events of visible orders" on public.order_events
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_events.order_id));

-- reviews: public to read; written through submit_review(); a customer may
-- delete their own, and admins may remove any (moderation).
grant select on public.reviews to anon, authenticated;
grant select on public.product_ratings to anon, authenticated;
grant delete on public.reviews to authenticated;
create policy "reviews are public" on public.reviews
  for select to anon, authenticated using (true);
create policy "delete own review or moderate" on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- custom requests: created through submit_custom_request() (server only, rate
-- limited). Customers read their own; admins read all and update the
-- workflow fields only.
grant select on public.custom_requests to authenticated;
grant update (status, quote_cents, shop_note) on public.custom_requests to authenticated;
create policy "read own custom requests" on public.custom_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "admins update custom requests" on public.custom_requests
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- newsletter: written by subscribe_newsletter() (server only); admins read
-- and remove.
grant select, delete on public.newsletter_subscribers to authenticated;
create policy "admins read subscribers" on public.newsletter_subscribers
  for select to authenticated using ((select public.is_admin()));
create policy "admins remove subscribers" on public.newsletter_subscribers
  for delete to authenticated using ((select public.is_admin()));

-- settings: public ones for everyone; private ones for admins only. Admins
-- may change values, never keys or the private flag.
grant select on public.shop_settings to anon, authenticated;
grant update (value) on public.shop_settings to authenticated;
create policy "public settings are readable" on public.shop_settings
  for select to anon, authenticated
  using (not is_private or (select public.is_admin()));
create policy "admins edit settings" on public.shop_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Postgres lets every role (PUBLIC) execute new functions by default.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
revoke all on all functions in schema private from public;
