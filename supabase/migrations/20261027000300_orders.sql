-- Skye Crafts: business operations.
--
-- Every write with rules attached happens inside one of these functions, in
-- one transaction, so the rules hold no matter who calls them or how often.
-- They run as "security definer" (with the owner's rights, past RLS), so each
-- one checks the caller itself first. `set search_path = ''` stops anyone
-- from shadowing a table or function name with their own.
--
-- Errors are raised with SQLSTATE P0001, a customer-safe message, and a
-- HINT naming the kind of error so the app can react:
--   invalid · auth · forbidden · not_found · conflict · limit
--
-- Lock order, to avoid deadlocks: orders -> products (by id) -> coupons (by id).
--
-- Local variables whose name matches a column are prefixed v_ (for example
-- v_code), because PL/pgSQL can't tell the two apart inside a query.

-- helpers -------------------------------------------------------------------

create or replace function private.fail(p_kind text, p_message text) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_message, hint = p_kind;
end
$$;

create or replace function private.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    perform private.fail('auth', 'Please log in first.');
  end if;
  return uid;
end
$$;

create or replace function private.require_admin() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  uid uuid := private.require_user();
begin
  if not public.is_admin() then
    perform private.fail('forbidden', 'Shop admin access is required.');
  end if;
  return uid;
end
$$;

create or replace function private.setting(p_key text) returns text
language sql stable set search_path = '' as $$
  select value from public.shop_settings where key = p_key
$$;

-- Coupons run on calendar days in Manila (UTC+8, no daylight saving).
create or replace function private.shop_today() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Manila')::date
$$;

-- Fixed-window counter. Returns true while the caller is under the limit.
create or replace function private.consume_rate_limit(
  p_bucket text, p_key text, p_max integer, p_window_seconds integer
) returns boolean
language plpgsql set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into private.rate_limits as r (bucket, key, window_start, hits)
  values (p_bucket, p_key, v_window, 1)
  on conflict (bucket, key, window_start)
    do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits <= p_max;
end
$$;

-- Reads a cart sent by the browser: [{product_id, quantity}, ...].
-- Duplicate lines are merged. Returns rows ordered by product id.
create or replace function private.parse_cart(p_items jsonb)
returns table (product_id bigint, quantity integer)
language plpgsql set search_path = '' as $$
declare
  item jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 50 then
    perform private.fail('invalid', 'Your cart is empty.');
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'product_id') is distinct from 'number'
       or jsonb_typeof(item -> 'quantity') is distinct from 'number'
       or (item ->> 'product_id') !~ '^[1-9][0-9]{0,17}$'
       or (item ->> 'quantity') !~ '^[1-9][0-9]?$' then
      perform private.fail('invalid', 'Your cart could not be read. Refresh the page and try again.');
    end if;
  end loop;

  return query
    select (e ->> 'product_id')::bigint, sum((e ->> 'quantity')::integer)::integer
    from jsonb_array_elements(p_items) as e
    group by 1
    order by 1;
end
$$;

-- Checks a coupon for this customer and subtotal; returns the discount.
-- At checkout (p_conflict) problems are "conflict" errors: the customer's
-- cart or the coupon changed since they pressed Apply.
create or replace function private.coupon_discount(
  p_coupon public.coupons, p_user uuid, p_subtotal integer, p_conflict boolean
) returns integer
language plpgsql set search_path = '' as $$
declare
  kind text := case when p_conflict then 'conflict' else 'invalid' end;
  discount integer;
begin
  if not p_coupon.is_active then
    perform private.fail(kind, 'This coupon is no longer active.');
  end if;
  if private.shop_today() < p_coupon.starts_on then
    perform private.fail(kind, format('This coupon is valid starting %s.',
      to_char(p_coupon.starts_on, 'FMMonth FMDD, YYYY')));
  end if;
  if private.shop_today() > p_coupon.ends_on then
    perform private.fail(kind, 'This coupon has expired.');
  end if;
  if p_coupon.max_uses > 0 and p_coupon.used_count >= p_coupon.max_uses then
    perform private.fail(kind, 'This coupon has reached its usage limit.');
  end if;
  -- Cancelled and declined orders give their coupon back, so they don't count.
  if p_coupon.once_per_customer and exists (
    select 1 from public.orders
    where buyer_id = p_user and coupon_id = p_coupon.id
      and status not in ('Declined', 'Cancelled')
  ) then
    perform private.fail(kind, 'You''ve already used this coupon.');
  end if;
  if p_coupon.min_order_cents > 0 and p_subtotal < p_coupon.min_order_cents then
    perform private.fail(kind, format('This coupon needs a minimum order of ₱%s.',
      to_char(p_coupon.min_order_cents / 100.0, 'FM999,999,990.00')));
  end if;

  if p_coupon.discount_type = 'percentage' then
    discount := (p_subtotal::bigint * p_coupon.discount_value / 100)::integer;
    if p_coupon.max_discount_cents > 0 then
      discount := least(discount, p_coupon.max_discount_cents);
    end if;
  else
    discount := least(p_coupon.discount_value, p_subtotal);
  end if;
  return discount;
end
$$;

-- Which status changes each kind of actor may make.
create or replace function private.can_transition(p_from text, p_to text, p_actor text)
returns boolean
language sql immutable as $$
  select case p_actor
    when 'shop' then (p_from, p_to) in (
      ('Placed', 'Approved'), ('Placed', 'Declined'),
      ('Approved', 'Packed'), ('Approved', 'Cancelled'),
      ('Packed', 'Shipped'), ('Packed', 'Cancelled'),
      ('Shipped', 'Delivered'))
    when 'customer' then (p_from, p_to) in (
      ('Placed', 'Cancelled'), ('Approved', 'Cancelled'),
      ('Shipped', 'Delivered'))
    when 'system' then (p_from, p_to) = ('Placed', 'Cancelled')
    else false
  end
$$;

-- Return an order's items to stock and its coupon use. Only ever called once
-- per order, from a status-checked transition to Declined or Cancelled.
create or replace function private.release_order(p_order_id bigint) returns void
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.products
  where id in (select product_id from public.order_items where order_id = p_order_id)
  order by id
  for update;

  update public.products as p
  set stock = least(p.stock + i.quantity, 100000)
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items
    where order_id = p_order_id and product_id is not null and not is_preorder
    group by product_id
  ) as i
  where p.id = i.product_id;

  update public.coupons
  set used_count = used_count - 1
  where used_count > 0
    and id = (select coupon_id from public.orders where id = p_order_id);
end
$$;

-- Apply a status change to an order the caller has already locked.
create or replace function private.transition(
  p_order_id bigint, p_to text, p_actor text, p_actor_id uuid, p_note text
) returns void
language plpgsql set search_path = '' as $$
declare
  current_status text;
begin
  select status into current_status from public.orders where id = p_order_id;
  if not private.can_transition(current_status, p_to, p_actor) then
    perform private.fail('conflict', format(
      'This order is %s, so it can''t be marked %s. Refresh and try again.',
      lower(current_status), lower(p_to)));
  end if;

  update public.orders
  set status = p_to,
      status_note = case when p_actor = 'customer' then status_note else coalesce(p_note, '') end,
      expires_at = null
  where id = p_order_id;

  insert into public.order_events (order_id, status, note, actor, actor_id)
  values (p_order_id, p_to, coalesce(p_note, ''), p_actor, p_actor_id);

  if p_to in ('Declined', 'Cancelled') then
    perform private.release_order(p_order_id);
  end if;
end
$$;

-- Online orders up to ₱1,000,000. Also keeps every amount well inside the
-- integer columns (the subtotal is added up as bigint first).
create or replace function private.check_order_size(p_subtotal bigint) returns void
language plpgsql as $$
begin
  if p_subtotal > 100000000 then
    perform private.fail('invalid', 'That order is too large to place online. Please message the shop.');
  end if;
end
$$;

-- checkout -------------------------------------------------------------------

-- Price a cart and check a coupon, without placing anything (the "Apply"
-- button). Shares coupon_discount with place_order so they can't disagree.
--
-- Returns {ok: true, code, subtotal_cents, discount_cents, total_cents}, or
-- {ok: false, kind, message} when the coupon can't be used. Coupon problems
-- are returned rather than raised so the attempt counter is still saved
-- (a raised error would roll it back and make guessing free).
create or replace function public.quote_coupon(p_code text, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_code text := upper(btrim(coalesce(p_code, '')));
  subtotal bigint := 0;
  line record;
  coupon public.coupons;
  discount integer;
  failure_kind text;
  failure_message text;
begin
  -- Slows down anyone trying to guess coupon codes.
  if not private.consume_rate_limit('coupon', uid::text, 20, 300) then
    return jsonb_build_object('ok', false, 'kind', 'limit',
      'message', 'Too many coupon attempts. Please wait a few minutes.');
  end if;

  for line in
    select c.quantity, p.price_cents, p.is_active
    from private.parse_cart(p_items) as c
    left join public.products as p on p.id = c.product_id
  loop
    if line.price_cents is null or not line.is_active then
      perform private.fail('conflict', 'An item in your cart is no longer available. Refresh your cart.');
    end if;
    subtotal := subtotal + line.price_cents::bigint * line.quantity;
  end loop;
  perform private.check_order_size(subtotal);

  begin
    select * into coupon from public.coupons where code = v_code;
    if not found or v_code !~ '^[A-Z0-9_-]{3,40}$' then
      perform private.fail('not_found', 'That coupon code is not valid.');
    end if;
    discount := private.coupon_discount(coupon, uid, subtotal::integer, false);
  exception when sqlstate 'P0001' then
    get stacked diagnostics failure_message = message_text, failure_kind = pg_exception_hint;
    return jsonb_build_object('ok', false, 'kind', failure_kind, 'message', failure_message);
  end;

  -- Remember the successful check: checkout accepts this coupon for an hour.
  insert into private.coupon_quotes (user_id, coupon_id, quoted_at)
  values (uid, coupon.id, now())
  on conflict (user_id, coupon_id) do update set quoted_at = excluded.quoted_at;

  return jsonb_build_object(
    'ok', true,
    'code', coupon.code,
    'subtotal_cents', subtotal,
    'discount_cents', discount,
    'total_cents', subtotal - discount
  );
end
$$;

-- Place an order. Prices, stock and the coupon all come from the database;
-- the browser only says which products and how many.
create or replace function public.place_order(
  p_items jsonb,
  p_recipient text,
  p_contact text,
  p_fulfillment text,
  p_address text,
  p_payment_method text,
  p_note text default '',
  p_coupon_code text default '',
  p_checkout_key text default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  recipient text := btrim(coalesce(p_recipient, ''));
  contact text := btrim(coalesce(p_contact, ''));
  address text := btrim(coalesce(p_address, ''));
  note text := btrim(coalesce(p_note, ''));
  v_coupon_code text := upper(btrim(coalesce(p_coupon_code, '')));
  fingerprint text;
  existing public.orders;
  ids bigint[];
  quantities integer[];
  i integer;
  product public.products;
  subtotal bigint := 0;
  coupon public.coupons;
  discount integer := 0;
  order_id bigint;
begin
  -- One checkout at a time per customer, so the limits below can't be raced.
  perform pg_advisory_xact_lock(hashtextextended('skye:checkout:' || uid::text, 0));

  if char_length(recipient) not between 2 and 80 then
    perform private.fail('invalid', 'Enter the recipient''s name (2-80 characters).');
  end if;
  if contact !~ '^[0-9+() -]{7,40}$' then
    perform private.fail('invalid', 'Enter a mobile number (digits, spaces, + or -).');
  end if;
  if p_fulfillment is null or p_fulfillment not in ('delivery', 'pickup') then
    perform private.fail('invalid', 'Choose delivery or pickup.');
  end if;
  if p_fulfillment = 'delivery' and char_length(address) not between 10 and 500 then
    perform private.fail('invalid', 'Enter the full delivery address (at least 10 characters).');
  end if;
  if p_fulfillment = 'pickup' then
    address := '';
  end if;
  if p_payment_method is null or p_payment_method not in ('gcash', 'cash_on_pickup') then
    perform private.fail('invalid', 'Choose how you will pay: GCash or cash on pickup.');
  end if;
  if p_payment_method = 'cash_on_pickup' and p_fulfillment <> 'pickup' then
    perform private.fail('invalid', 'Cash on pickup is only for pickup orders. Delivery orders are paid by GCash.');
  end if;
  if char_length(note) > 300 then
    perform private.fail('invalid', 'Keep the note to 300 characters or fewer.');
  end if;
  if p_checkout_key is not null and p_checkout_key !~ '^[A-Za-z0-9-]{16,64}$' then
    perform private.fail('invalid', 'Your checkout could not be read. Refresh the page and try again.');
  end if;

  select array_agg(c.product_id order by c.product_id),
         array_agg(c.quantity order by c.product_id),
         string_agg(c.product_id || ':' || c.quantity, ',' order by c.product_id)
  into ids, quantities, fingerprint
  from private.parse_cart(p_items) as c;

  -- A retry of a checkout that already went through returns the same order.
  if p_checkout_key is not null then
    select * into existing from public.orders
    where buyer_id = uid and checkout_key = p_checkout_key;
    if found then
      if existing.cart_fingerprint <> fingerprint then
        perform private.fail('conflict', 'This checkout was already submitted with a different cart. Refresh the page and try again.');
      end if;
      return existing.id;
    end if;
  end if;

  -- Stop one account from holding the whole stock with unpaid orders.
  if (select count(*) from public.orders where buyer_id = uid and status = 'Placed') >= 3 then
    perform private.fail('limit', 'You already have 3 orders waiting for the shop to confirm them. Please wait, or cancel one, before placing another.');
  end if;
  if (select count(*) from public.orders
      where buyer_id = uid and created_at > now() - interval '1 hour') >= 10 then
    perform private.fail('limit', 'Too many orders in the last hour. Please try again later.');
  end if;

  -- Lock the products (in id order) so two buyers can't take the last item.
  perform 1 from public.products where id = any(ids) order by id for update;

  for i in 1 .. array_length(ids, 1) loop
    select * into product from public.products where id = ids[i];
    if not found or not product.is_active then
      perform private.fail('conflict', 'An item in your cart is no longer available. Refresh your cart.');
    end if;
    if quantities[i] > 99 then
      perform private.fail('invalid', format('You can order at most 99 of %s.', product.title));
    end if;
    if not product.is_preorder and product.stock < quantities[i] then
      perform private.fail('conflict', case when product.stock = 0
        then format('%s is sold out.', product.title)
        else format('Only %s left of %s.', product.stock, product.title) end);
    end if;
    subtotal := subtotal + product.price_cents::bigint * quantities[i];
  end loop;
  perform private.check_order_size(subtotal);

  if v_coupon_code <> '' then
    select * into coupon from public.coupons
    where code = v_coupon_code
    for update;
    -- Only coupons this customer checked with "Apply" (quote_coupon) in the
    -- last hour. Unknown and unchecked codes get the same answer, so this
    -- can't be used to guess codes without going through the attempt limit.
    if not found or not exists (
      select 1 from private.coupon_quotes q
      where q.user_id = uid and q.coupon_id = coupon.id and q.quoted_at > now() - interval '1 hour'
    ) then
      perform private.fail('conflict', 'Apply the coupon again, then place your order.');
    end if;
    discount := private.coupon_discount(coupon, uid, subtotal::integer, true);
    update public.coupons set used_count = used_count + 1 where id = coupon.id;
  end if;

  insert into public.orders (
    buyer_id, buyer_email, recipient, contact, fulfillment, address,
    payment_method, note, subtotal_cents, discount_cents, total_cents,
    coupon_id, coupon_code, checkout_key, cart_fingerprint, expires_at
  ) values (
    uid, coalesce((select email from auth.users where id = uid), ''),
    recipient, contact, p_fulfillment, address,
    p_payment_method, note, subtotal, discount, subtotal - discount,
    coupon.id, coalesce(coupon.code, ''), p_checkout_key, fingerprint,
    now() + make_interval(hours => coalesce(private.setting('unpaid_order_hours'), '48')::integer)
  ) returning id into order_id;

  insert into public.order_items (order_id, product_id, title, price_cents, quantity, is_preorder)
  select order_id, p.id, p.title, p.price_cents, c.quantity, p.is_preorder
  from unnest(ids, quantities) as c (product_id, quantity)
  join public.products as p on p.id = c.product_id;

  update public.products as p
  set stock = p.stock - c.quantity
  from unnest(ids, quantities) as c (product_id, quantity)
  where p.id = c.product_id and not p.is_preorder;

  insert into public.order_events (order_id, status, note, actor, actor_id)
  values (order_id, 'Placed', 'Order placed', 'customer', uid);

  return order_id;
end
$$;

-- after checkout ------------------------------------------------------------

create or replace function public.cancel_order(p_order_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  current_status text;
begin
  select status into current_status from public.orders
  where id = p_order_id and buyer_id = uid
  for update;
  if not found then
    perform private.fail('not_found', 'Order not found.');
  end if;
  if current_status not in ('Placed', 'Approved') then
    perform private.fail('conflict', 'This order can no longer be cancelled because the shop has already packed it.');
  end if;
  perform private.transition(p_order_id, 'Cancelled', 'customer', uid, 'Cancelled by customer');
end
$$;

create or replace function public.confirm_receipt(p_order_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  current_status text;
begin
  select status into current_status from public.orders
  where id = p_order_id and buyer_id = uid
  for update;
  if not found then
    perform private.fail('not_found', 'Order not found.');
  end if;
  if current_status <> 'Shipped' then
    perform private.fail('conflict', 'This order can''t be confirmed yet.');
  end if;
  perform private.transition(p_order_id, 'Delivered', 'customer', uid, 'Received by customer');
end
$$;

-- Link an uploaded GCash receipt to the customer's order. The file must
-- already be in the customer's own folder of the "receipts" bucket.
create or replace function public.attach_receipt(p_order_id bigint, p_path text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  target public.orders;
begin
  if p_path is null or p_path !~ ('^' || uid::text || '/[A-Za-z0-9._-]{1,100}$') then
    perform private.fail('invalid', 'That receipt file could not be read. Upload it again.');
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'receipts' and name = p_path) then
    perform private.fail('invalid', 'Upload the receipt first.');
  end if;

  select * into target from public.orders
  where id = p_order_id and buyer_id = uid
  for update;
  if not found then
    perform private.fail('not_found', 'Order not found.');
  end if;
  if target.payment_method <> 'gcash' or target.status <> 'Placed' then
    perform private.fail('conflict', 'A receipt can only be added while a GCash order waits for approval.');
  end if;

  update public.orders set receipt_path = p_path where id = p_order_id;
  insert into public.order_events (order_id, status, note, actor, actor_id)
  values (p_order_id, 'Placed', 'Payment receipt uploaded', 'customer', uid);
end
$$;

-- Shop details a customer needs for their own order, at the step they need
-- them: GCash details while a GCash order waits for payment, and the pickup
-- location only once the shop has approved a pickup order (so it can't be
-- collected by placing and cancelling an order).
create or replace function public.order_private_details(p_order_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  target public.orders;
  details jsonb := '{}'::jsonb;
begin
  select * into target from public.orders where id = p_order_id and buyer_id = uid;
  if not found then
    perform private.fail('not_found', 'Order not found.');
  end if;
  if target.payment_method = 'gcash' and target.status = 'Placed' then
    details := details || jsonb_build_object(
      'gcash_name', private.setting('gcash_name'),
      'gcash_number', private.setting('gcash_number'));
  end if;
  if target.fulfillment = 'pickup' and target.status in ('Approved', 'Packed', 'Shipped') then
    details := details || jsonb_build_object(
      'pickup_location', private.setting('pickup_location'),
      'pickup_schedule', private.setting('pickup_schedule'));
  end if;
  return details;
end
$$;

-- Cancel unapproved orders whose payment window has passed (orders with an
-- uploaded receipt wait for the owner instead). Safe to call often and from
-- several places at once; returns how many orders were cancelled.
create or replace function public.expire_stale_orders() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  stale bigint[];
  order_id bigint;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('skye:expire', 0)) then
    return 0;  -- another call is already doing it
  end if;

  select array_agg(id order by id) into stale from (
    select id from public.orders
    where status = 'Placed' and receipt_path is null and expires_at < now()
    order by id
    limit 200
    for update skip locked
  ) as s;
  if stale is null then
    return 0;
  end if;

  -- Take every lock up front, in the global order, before changing anything.
  perform 1 from public.products
  where id in (select product_id from public.order_items where order_items.order_id = any(stale))
  order by id for update;
  perform 1 from public.coupons
  where id in (select coupon_id from public.orders where id = any(stale))
  order by id for update;

  foreach order_id in array stale loop
    perform private.transition(order_id, 'Cancelled', 'system', null,
      'Not confirmed within the payment window, so the order was cancelled and its items were returned to stock.');
  end loop;
  return array_length(stale, 1);
end
$$;

-- reviews --------------------------------------------------------------------

create or replace function private.has_received(p_user uuid, p_product_id bigint)
returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.order_items i
    join public.orders o on o.id = i.order_id
    where o.buyer_id = p_user and i.product_id = p_product_id and o.status = 'Delivered'
  )
$$;

create or replace function public.can_review(p_product_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.has_received(auth.uid(), p_product_id)
$$;

-- Reviews are limited to customers who received the item. Submitting again
-- replaces the customer's earlier review.
create or replace function public.submit_review(p_product_id bigint, p_rating integer, p_body text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  body text := btrim(coalesce(p_body, ''));
begin
  if p_rating is null or p_rating not between 1 and 5 then
    perform private.fail('invalid', 'Choose a rating from 1 to 5 stars.');
  end if;
  if char_length(body) > 1000 then
    perform private.fail('invalid', 'Keep your review to 1000 characters or fewer.');
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    perform private.fail('not_found', 'Product not found.');
  end if;
  if not private.has_received(uid, p_product_id) then
    perform private.fail('forbidden', 'Only customers who have received this item can review it.');
  end if;

  insert into public.reviews (product_id, user_id, rating, body)
  values (p_product_id, uid, p_rating, body)
  on conflict (product_id, user_id)
    do update set rating = excluded.rating, body = excluded.body;
end
$$;

-- public forms (called by the server only, with a hashed client address) --

create or replace function public.submit_custom_request(
  p_user_id uuid, p_client_hash text,
  p_name text, p_contact text, p_occasion text, p_details text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  request_id bigint;
begin
  if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    perform private.fail('invalid', 'Request could not be read.');
  end if;
  if not private.consume_rate_limit('custom_request', p_client_hash, 5, 3600) then
    perform private.fail('limit', 'Too many requests. Please try again in an hour.');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80 then
    perform private.fail('invalid', 'Enter your name (2-80 characters).');
  end if;
  if char_length(btrim(coalesce(p_contact, ''))) not between 5 and 120 then
    perform private.fail('invalid', 'Enter an email address or mobile number.');
  end if;
  if char_length(btrim(coalesce(p_occasion, ''))) > 100 then
    perform private.fail('invalid', 'Keep the occasion to 100 characters or fewer.');
  end if;
  if char_length(btrim(coalesce(p_details, ''))) not between 10 and 2000 then
    perform private.fail('invalid', 'Describe your idea in 10 to 2000 characters.');
  end if;

  insert into public.custom_requests (user_id, name, contact, occasion, details)
  values (
    (select id from public.profiles where id = p_user_id),
    btrim(p_name), btrim(p_contact), btrim(coalesce(p_occasion, '')), btrim(p_details)
  ) returning id into request_id;
  return request_id;
end
$$;

create or replace function public.subscribe_newsletter(p_client_hash text, p_email text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_client_hash is null or p_client_hash !~ '^[a-f0-9]{64}$' then
    perform private.fail('invalid', 'Request could not be read.');
  end if;
  if not private.consume_rate_limit('newsletter', p_client_hash, 5, 3600) then
    perform private.fail('limit', 'Too many attempts. Please try again in an hour.');
  end if;
  if char_length(email) > 254 or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.fail('invalid', 'Enter a valid email address.');
  end if;
  -- Same result whether or not the address was already subscribed, so the
  -- form can't be used to find out who is on the list.
  insert into public.newsletter_subscribers (email) values (email)
  on conflict do nothing;
end
$$;

-- admin ------------------------------------------------------------------------

create or replace function public.admin_set_order_status(
  p_order_id bigint, p_status text, p_note text default ''
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin_id uuid := private.require_admin();
  note text := btrim(coalesce(p_note, ''));
begin
  if p_status is null or p_status not in ('Approved', 'Packed', 'Shipped', 'Delivered', 'Declined', 'Cancelled') then
    perform private.fail('invalid', 'Invalid status.');
  end if;
  if char_length(note) > 300 then
    perform private.fail('invalid', 'Keep the note to 300 characters or fewer.');
  end if;
  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    perform private.fail('not_found', 'Order not found.');
  end if;
  perform private.transition(p_order_id, p_status, 'shop', admin_id, note);
end
$$;

-- Order list for the admin page: optional status filter, search by order
-- number / recipient / contact / email, newest first, paged.
create or replace function public.admin_search_orders(
  p_status text default null,
  p_query text default '',
  p_limit integer default 20,
  p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := btrim(coalesce(p_query, ''));
  pattern text;
  order_number bigint;
  result jsonb;
begin
  perform private.require_admin();
  if q ~ '^#?[0-9]{1,18}$' then
    order_number := ltrim(q, '#')::bigint;
  end if;
  -- Escape LIKE wildcards so a search for "50%" means the text "50%".
  pattern := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  with matching as (
    select o.*
    from public.orders o
    where (p_status is null or p_status = '' or o.status = p_status)
      and (q = ''
           or o.id = order_number
           or o.recipient ilike pattern
           or o.contact ilike pattern
           or o.buyer_email ilike pattern)
  )
  select jsonb_build_object(
    'total', (select count(*) from matching),
    'orders', coalesce((
      select jsonb_agg(row_to_json(page) order by page.id desc)
      from (
        select m.id, m.status, m.recipient, m.contact, m.fulfillment,
               m.payment_method, m.total_cents, m.created_at,
               m.receipt_path is not null as has_receipt,
               p.username as buyer,
               (select coalesce(sum(i.quantity), 0) from public.order_items i where i.order_id = m.id) as item_count
        from matching m
        join public.profiles p on p.id = m.buyer_id
        order by m.id desc
        limit least(greatest(coalesce(p_limit, 20), 1), 100)
        offset greatest(coalesce(p_offset, 0), 0)
      ) as page
    ), '[]'::jsonb)
  ) into result;
  return result;
end
$$;

-- An order's history with the name of the admin account behind each change
-- (customers can't read actor_id; see the security migration).
create or replace function public.admin_order_events(p_order_id bigint)
returns table (id bigint, status text, note text, actor text, actor_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select e.id, e.status, e.note, e.actor, p.username, e.created_at
    from public.order_events e
    left join public.profiles p on p.id = e.actor_id
    where e.order_id = p_order_id
    order by e.id;
end
$$;

create or replace function public.admin_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  threshold integer := coalesce(private.setting('low_stock_threshold'), '3')::integer;
begin
  perform private.require_admin();
  return jsonb_build_object(
    'status_counts', coalesce((
      select jsonb_object_agg(status, n)
      from (select status, count(*) as n from public.orders group by status) s
    ), '{}'::jsonb),
    'receipts_to_check', (
      select count(*) from public.orders where status = 'Placed' and receipt_path is not null),
    'sales_30d_cents', (
      select coalesce(sum(total_cents), 0) from public.orders
      where status in ('Approved', 'Packed', 'Shipped', 'Delivered')
        and created_at > now() - interval '30 days'),
    'orders_30d', (
      select count(*) from public.orders
      where status in ('Approved', 'Packed', 'Shipped', 'Delivered')
        and created_at > now() - interval '30 days'),
    'new_requests', (
      select count(*) from public.custom_requests where status = 'New'),
    'low_stock', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'stock', stock) order by stock, id)
      from public.products
      where is_active and not is_preorder and stock <= threshold
    ), '[]'::jsonb)
  );
end
$$;

-- who may call what -----------------------------------------------------------

revoke all on all functions in schema private from public;
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.can_review(bigint) to anon, authenticated, service_role;

grant execute on function
  public.quote_coupon(text, jsonb),
  public.place_order(jsonb, text, text, text, text, text, text, text, text),
  public.cancel_order(bigint),
  public.confirm_receipt(bigint),
  public.attach_receipt(bigint, text),
  public.order_private_details(bigint),
  public.expire_stale_orders(),
  public.submit_review(bigint, integer, text),
  public.admin_set_order_status(bigint, text, text),
  public.admin_search_orders(text, text, integer, integer),
  public.admin_order_events(bigint),
  public.admin_summary()
to authenticated, service_role;

-- Only the server (service role) may call these: it adds a hashed client
-- address so the rate limit can't be dodged by calling the API directly.
grant execute on function
  public.submit_custom_request(uuid, text, text, text, text, text),
  public.subscribe_newsletter(text, text)
to service_role;
