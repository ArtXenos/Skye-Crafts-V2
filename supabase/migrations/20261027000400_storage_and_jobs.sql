-- Skye Crafts: file storage and scheduled jobs.

-- Product photos: anyone can view; only admins upload, replace or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 4194304,  -- 4 MB (Vercel caps request bodies at 4.5 MB)
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- GCash payment receipts: private. A customer uploads into a folder named
-- after their own user id and can see only that folder; admins see all.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 4194304,  -- 4 MB (Vercel caps request bodies at 4.5 MB)
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage needs a SELECT policy to delete or replace a file (it looks the
-- file up first). Public viewing goes through the public URL, not this.
create policy "admins see product images" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "admins replace product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "admins delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

create policy "customers upload own receipts" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "read own receipts or any as admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or (select public.is_admin()))
  );
create policy "admins delete receipts" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (select public.is_admin()));

-- Scheduled jobs (pg_cron). Every Supabase project has pg_cron available;
-- if it is not (for example a plain local Postgres), this step is skipped
-- and expiry still runs before each checkout and on the admin Orders page.
do $outer$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'skye-expire-stale-orders', '*/10 * * * *',
      'select public.expire_stale_orders()');
    perform cron.schedule(
      'skye-clean-rate-limits', '17 3 * * *',
      $$delete from private.rate_limits where window_start < now() - interval '2 days'$$);
  else
    raise notice 'pg_cron is not available; skipping scheduled jobs.';
  end if;
end
$outer$;
