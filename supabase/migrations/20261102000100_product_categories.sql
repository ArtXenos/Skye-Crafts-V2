-- Skye Crafts: product categories, organised by what the shop sells.
--
-- Every variety is its own product row (its own name, photo, price and
-- stock); categories only group them. This migration:
--   1. renames the four original categories to their full names, and
--   2. adds "Accessories" (hair clips, bracelets and other add-ons).
-- Keychains stay their own category, for every kind of keychain (mirror
-- keychains included), so nothing is listed under two categories.
-- Product ids, photos, prices, stock and past orders are untouched: orders
-- keep their own copy of each product's name and price, not its category.

-- The original rule was an unnamed check; find it by what it says.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.products'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%category%'
  loop
    execute format('alter table public.products drop constraint %I', v_name);
  end loop;
end
$$;

update public.products set category = case category
  when 'Bouquets' then 'Flower Bouquets'
  when 'Pots' then 'Fuzzy Wire Pots'
  when 'Figurines' then 'Desk Figurines'
  else category end
where category in ('Bouquets', 'Pots', 'Figurines');

alter table public.products add constraint products_category_check check (category in (
  'Flower Bouquets', 'Keychains', 'Fuzzy Wire Pots', 'Desk Figurines', 'Accessories'
));

-- Browsing a category lists its varieties.
create index if not exists products_category on public.products (category, id);
