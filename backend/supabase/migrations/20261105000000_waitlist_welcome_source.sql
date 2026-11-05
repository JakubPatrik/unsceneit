-- Adds 'welcome' as a waitlist source: sign-ups from the page the extension
-- opens on first install (website/src/pages/welcome.tsx). 'extension' stays for
-- the live AI button, which opens /waitlist/?from=extension.
--
-- Apply this before deploying the website: until then join_waitlist() saves
-- 'welcome' sign-ups as 'website'.

alter table public.waitlist drop constraint waitlist_source_check;
alter table public.waitlist
  add constraint waitlist_source_check check (source in ('website', 'extension', 'welcome'));

-- Same signature and return type, so the existing grants carry over.
create or replace function public.join_waitlist(p_email text, p_source text default 'website')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  text := lower(btrim(p_email));
  v_joined timestamptz;
  v_id     uuid;
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  insert into public.waitlist (email, source)
  values (v_email, case when p_source in ('extension', 'welcome') then p_source else 'website' end)
  on conflict (lower(email)) do nothing;

  select created_at, id into v_joined, v_id from public.waitlist where lower(email) = v_email;
  return (
    select count(*)::integer from public.waitlist w
    where (w.created_at, w.id) <= (v_joined, v_id)
  );
end;
$$;
