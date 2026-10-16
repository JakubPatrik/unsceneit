-- Early access waitlist for live AI / Pro (TODO.md, option 3A).
--
-- The website's /waitlist/ form calls join_waitlist() with the publishable
-- key. Nobody can read, change or delete rows through the API: the table has
-- no grants, and the function only adds an address. Admins read the list in
-- the dashboard (or with the secret key).
--
-- Everyone on the list is promised founding-member (lifetime) pricing on Pro;
-- created_at is when they joined.

create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  source     text not null default 'website' check (source in ('website', 'extension')),
  created_at timestamptz not null default now(),
  constraint waitlist_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254)
);

-- One row per address, whatever the capitalisation.
create unique index waitlist_email_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;
-- No policies: with RLS on and no grants, the table is closed to API users.
revoke all on public.waitlist from anon, authenticated;

-- Adds an address to the waitlist. Joining twice is not an error (the first
-- sign-up keeps its date), so the form can't be used to check who is on the
-- list. Returns nothing.
create function public.join_waitlist(p_email text, p_source text default 'website')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  insert into public.waitlist (email, source)
  values (v_email, case when p_source = 'extension' then 'extension' else 'website' end)
  on conflict (lower(email)) do nothing;
end;
$$;

-- Supabase grants new functions to everyone by default; start from nothing.
revoke all on function public.join_waitlist(text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text) to anon, authenticated, service_role;
