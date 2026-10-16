-- join_waitlist() now returns the address's place on the waitlist (1 = first
-- to join), shown as "#1" on the website's "You're on the list" card. Joining
-- again returns the same place, as the first sign-up keeps its date.

drop function public.join_waitlist(text, text);

create function public.join_waitlist(p_email text, p_source text default 'website')
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
  values (v_email, case when p_source = 'extension' then 'extension' else 'website' end)
  on conflict (lower(email)) do nothing;

  select created_at, id into v_joined, v_id from public.waitlist where lower(email) = v_email;
  return (
    select count(*)::integer from public.waitlist w
    where (w.created_at, w.id) <= (v_joined, v_id)
  );
end;
$$;

-- Supabase grants new functions to everyone by default; start from nothing.
revoke all on function public.join_waitlist(text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text) to anon, authenticated, service_role;
