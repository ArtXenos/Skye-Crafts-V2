-- Skye Crafts: an order's mobile number must be a Philippine mobile number,
-- saved one way: 09XXXXXXXXX.
--
-- Accepted as typed: 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX, with any
-- spaces or dashes ("0917 123 4567", "+63 917-123-4567").
--
-- A trigger checks it, not a CHECK constraint. Postgres re-checks a CHECK
-- (even a NOT VALID one) whenever an old row is updated, so an old order
-- with a number in another format couldn't change status any more. The
-- trigger only looks at new orders and at orders whose number changes.
-- Custom requests are not affected: their contact may be an email.

-- The number as 09XXXXXXXXX, or null if it isn't a PH mobile number.
create or replace function private.ph_mobile(p_value text) returns text
language sql immutable set search_path = '' as $$
  select case
    when digits ~ '^09[0-9]{9}$' then digits
    when digits ~ '^\+?639[0-9]{9}$' then '0' || right(digits, 10)
  end
  from (select regexp_replace(coalesce(p_value, ''), '[[:space:]-]', '', 'g') as digits) as typed
$$;

-- 1. Save existing numbers the new way where they can be read. Leave
--    updated_at alone: this isn't a change anyone made to the order.
alter table public.orders disable trigger orders_touch;
update public.orders
set contact = private.ph_mobile(contact)
where private.ph_mobile(contact) is not null
  and contact <> private.ph_mobile(contact);
alter table public.orders enable trigger orders_touch;

do $$
declare
  v_left integer;
begin
  select count(*) into v_left from public.orders where private.ph_mobile(contact) is null;
  raise notice '% old order(s) kept a number that isn''t a PH mobile number (left unchanged).', v_left;
end
$$;

-- 2. From now on, every new order (and any changed number) is checked and
--    saved as 09XXXXXXXXX.
create or replace function private.check_order_contact() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_contact text := private.ph_mobile(new.contact);
begin
  if v_contact is null then
    perform private.fail('invalid', 'Enter a valid PH mobile number, e.g. 0917 123 4567.');
  end if;
  new.contact := v_contact;
  return new;
end
$$;

create trigger orders_contact_ph_mobile before insert or update of contact on public.orders
  for each row execute function private.check_order_contact();

revoke all on function private.ph_mobile(text), private.check_order_contact() from public;
