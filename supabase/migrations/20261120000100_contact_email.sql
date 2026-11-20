-- Skye Crafts: a public contact email.
--
-- Shown in the footer and on the privacy page, where customers send
-- requests about their personal data (Data Privacy Act of 2012). Public, like
-- the contact number.

-- 1. Allow the new key (the list was last set in 20261101000100_pickup_map.sql).
alter table public.shop_settings drop constraint shop_settings_key_check;
alter table public.shop_settings add constraint shop_settings_key_check check (key in (
  'pickup_location', 'pickup_schedule', 'public_area', 'pickup_coordinates',
  'gcash_name', 'gcash_number',
  'shipping_note', 'lead_time_ready', 'lead_time_custom',
  'cancellation_note', 'damaged_note', 'refund_note',
  'unpaid_order_hours', 'low_stock_threshold',
  'facebook_url', 'tiktok_url', 'contact_phone', 'contact_email'
));

-- 2. Empty (hidden), or something shaped like an email address. The general
--    length check allows 400 characters; an address is at most 254.
alter table public.shop_settings add constraint shop_settings_contact_email_check check (
  key <> 'contact_email'
  or value = ''
  or (char_length(value) <= 254 and value ~ '^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$')
);

insert into public.shop_settings (key, value, is_private)
values ('contact_email', '', false)
on conflict (key) do nothing;
