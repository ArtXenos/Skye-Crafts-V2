-- Starter catalogue (the same four pieces as the Flask version). Prices are
-- in centavos. Each variety the shop sells is its own product: add the real
-- varieties (with their photos and prices) on /admin/products. Stock numbers are placeholders: change them on /admin.
-- `supabase db reset` runs this automatically; on a hosted project, paste it
-- into the SQL editor once. It does nothing if products already exist.
insert into public.products (title, description, category, price_cents, stock, is_preorder)
select * from (values
  ('Fuzzy Wire Bouquet', 'A hand-shaped rose bouquet, wrapped and ribboned to order.', 'Flower Bouquets', 45000, 10, false),
  ('Mirror Keychain', 'A compact pompom flower keychain with a built-in mirror.', 'Keychains', 15000, 25, false),
  ('Fuzzy Wire Pot', 'A miniature potted flower arrangement for any desk or shelf.', 'Fuzzy Wire Pots', 28000, 12, false),
  ('Desk Figurine', 'A custom character or shape figurine, made to your reference.', 'Desk Figurines', 32000, 0, true)
) as seed (title, description, category, price_cents, stock, is_preorder)
where not exists (select 1 from public.products);
