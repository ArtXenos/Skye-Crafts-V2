-- Skye Crafts: customers can change their own custom requests.
--
-- A request with an account can be edited while the shop hasn't started on
-- it ('New' or 'Quoted'). Only the contact, occasion and details change;
-- status, quote and the shop's note stay the shop's. Editing a quoted
-- request withdraws the quote (it was for the old details) and puts it back
-- to 'New'. Guest requests have no owner, so nobody can edit them.

-- When the customer last changed it, so the owner re-reads before quoting.
-- Set only by update_custom_request(): the API grants no one UPDATE on it.
alter table public.custom_requests add column edited_at timestamptz;

create or replace function public.update_custom_request(
  p_id bigint, p_contact text, p_occasion text, p_details text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  target public.custom_requests;
  v_contact text := btrim(coalesce(p_contact, ''));
  v_occasion text := btrim(coalesce(p_occasion, ''));
  v_details text := btrim(coalesce(p_details, ''));
begin
  select * into target from public.custom_requests where id = p_id for update;
  -- Someone else's request (or a guest's) looks the same as a missing one.
  if not found or target.user_id is distinct from uid then
    perform private.fail('not_found', 'Request not found.');
  end if;
  if target.status not in ('New', 'Quoted') then
    perform private.fail('conflict', 'This request is locked. Contact the shop to change it.');
  end if;
  if char_length(v_contact) not between 5 and 120 then
    perform private.fail('invalid', 'Enter an email address or mobile number.');
  end if;
  if char_length(v_occasion) > 100 then
    perform private.fail('invalid', 'Keep the occasion to 100 characters or fewer.');
  end if;
  if char_length(v_details) not between 10 and 2000 then
    perform private.fail('invalid', 'Describe your idea in 10 to 2000 characters.');
  end if;

  update public.custom_requests
  set contact = v_contact,
      occasion = v_occasion,
      details = v_details,
      -- A quote was for the old details: withdraw it and quote again.
      status = 'New',
      quote_cents = case when target.status = 'Quoted' then null else quote_cents end,
      edited_at = now()
  where id = p_id;
  return 'New';
end
$$;

revoke all on function public.update_custom_request(bigint, text, text, text) from public, anon;
grant execute on function public.update_custom_request(bigint, text, text, text) to authenticated;
