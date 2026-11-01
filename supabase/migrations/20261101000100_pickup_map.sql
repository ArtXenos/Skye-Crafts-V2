-- Skye Crafts: a map pin for the pickup place.
--
-- The pin is a private setting, like the pickup address itself: it is stored
-- as "latitude,longitude" (for example "7.073100,125.612800") and only given
-- to a customer through order_private_details, once the shop has approved
-- their pickup order.

-- 1. Allow the new key. The original key list was an unnamed check, so find
--    it by what it says rather than by its generated name.
do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'public.shop_settings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%gcash_name%'
    and pg_get_constraintdef(oid) like '%tiktok_url%'
    and pg_get_constraintdef(oid) not like '%char_length%';
  if v_name is not null then
    execute format('alter table public.shop_settings drop constraint %I', v_name);
  end if;
end
$$;

alter table public.shop_settings add constraint shop_settings_key_check check (key in (
  'pickup_location', 'pickup_schedule', 'public_area', 'pickup_coordinates',
  'gcash_name', 'gcash_number',
  'shipping_note', 'lead_time_ready', 'lead_time_custom',
  'cancellation_note', 'damaged_note', 'refund_note',
  'unpaid_order_hours', 'low_stock_threshold',
  'facebook_url', 'tiktok_url', 'contact_phone'
));

-- 2. Empty (no pin), or a real latitude/longitude pair. CASE keeps the
--    numeric casts from running on text that isn't a number.
alter table public.shop_settings add constraint shop_settings_coordinates_check check (
  case
    when key <> 'pickup_coordinates' or value = '' then true
    when value !~ '^-?[0-9]{1,2}(\.[0-9]{1,7})?,-?[0-9]{1,3}(\.[0-9]{1,7})?$' then false
    else abs(split_part(value, ',', 1)::numeric) <= 90
     and abs(split_part(value, ',', 2)::numeric) <= 180
  end
);

insert into public.shop_settings (key, value, is_private)
values ('pickup_coordinates', '', true)
on conflict (key) do nothing;

-- 3. Hand the pin out at the same step as the address.
create or replace function public.order_private_details(p_order_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  target public.orders;
  details jsonb := '{}'::jsonb;
  v_pin text;
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
    v_pin := coalesce(private.setting('pickup_coordinates'), '');
    if v_pin <> '' then
      details := details || jsonb_build_object('pickup_coordinates', v_pin);
    end if;
  end if;
  return details;
end
$$;

-- create or replace keeps the existing grants, but state them again so this
-- file reads correctly on its own.
revoke all on function public.order_private_details(bigint) from public, anon;
grant execute on function public.order_private_details(bigint) to authenticated;
