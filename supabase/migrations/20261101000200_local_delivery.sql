-- Skye Crafts: delivery is local (within Governor Generoso, Davao Oriental),
-- not through J&T Express. Only replaces the original default wording, so
-- anything the owner already typed on the Settings page is kept.

update public.shop_settings
set value = 'Governor Generoso, Davao Oriental'
where key = 'public_area' and value = 'the Philippines';

update public.shop_settings
set value = 'We deliver within Governor Generoso only. The delivery fee depends on your barangay and is confirmed by message before payment.'
where key = 'shipping_note'
  and value = 'Shipping is paid by the customer through J&T Express. The fee is confirmed by message before payment.';
