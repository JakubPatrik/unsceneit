-- Free live AI for every extension install.
--
-- classify-frames now also accepts the publishable key (store builds). Those
-- calls are charged here, in seconds of video sent to the AI (seconds the
-- library already answered are free):
--   - per install: a random id the extension keeps in chrome.storage.local,
--     with a monthly allowance (calendar month, UTC);
--   - per IP: a daily allowance (UTC), so reinstalling or minting new install
--     ids doesn't add free minutes. Only a salted SHA-256 of the IP is stored.
-- The allowances themselves are Edge Function settings, passed in as limits.
-- Secret-key callers (scripts, dev builds) are never charged.

create table public.live_ai_usage (
  scope text not null check (scope in ('install', 'ip')),
  subject text not null, -- install id, or the IP's hash (never the raw IP)
  period text not null, -- 'YYYY-MM' for installs, 'YYYY-MM-DD' for IPs (UTC)
  seconds_used integer not null default 0 check (seconds_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject, period)
);

-- No policies: only the secret key (classify-frames) reads or writes it.
alter table public.live_ai_usage enable row level security;
revoke all on public.live_ai_usage from anon, authenticated;

-- Charges up to p_seconds against both allowances, atomically, and returns
--   { granted, install_used, ip_left }
-- granted: how many seconds may be analysed now (0 when either allowance is
-- used up). p_seconds = 0 only reads the current usage.
create or replace function public.live_ai_reserve(
  p_install_id text,
  p_ip_hash text,
  p_seconds integer,
  p_install_limit integer,
  p_ip_limit integer
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_day text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  v_install integer;
  v_ip integer;
  v_granted integer;
begin
  insert into public.live_ai_usage (scope, subject, period)
  values ('install', p_install_id, v_month), ('ip', p_ip_hash, v_day)
  on conflict do nothing;

  -- Always lock in this order (install, then IP), so concurrent calls can't deadlock.
  select seconds_used into v_install from public.live_ai_usage
  where scope = 'install' and subject = p_install_id and period = v_month
  for update;
  select seconds_used into v_ip from public.live_ai_usage
  where scope = 'ip' and subject = p_ip_hash and period = v_day
  for update;

  v_granted := greatest(0, least(greatest(p_seconds, 0), p_install_limit - v_install, p_ip_limit - v_ip));
  if v_granted > 0 then
    update public.live_ai_usage set seconds_used = seconds_used + v_granted, updated_at = now()
    where (scope = 'install' and subject = p_install_id and period = v_month)
       or (scope = 'ip' and subject = p_ip_hash and period = v_day);
  end if;

  return jsonb_build_object(
    'granted', v_granted,
    'install_used', v_install + v_granted,
    'ip_left', greatest(0, p_ip_limit - v_ip - v_granted)
  );
end;
$$;

-- Gives back seconds that were reserved but not analysed (the AI call failed).
create or replace function public.live_ai_refund(
  p_install_id text,
  p_ip_hash text,
  p_seconds integer
) returns void
language sql
set search_path = ''
as $$
  update public.live_ai_usage
  set seconds_used = greatest(0, seconds_used - greatest(p_seconds, 0)), updated_at = now()
  where (scope = 'install' and subject = p_install_id and period = to_char(now() at time zone 'utc', 'YYYY-MM'))
     or (scope = 'ip' and subject = p_ip_hash and period = to_char(now() at time zone 'utc', 'YYYY-MM-DD'));
$$;

revoke execute on function public.live_ai_reserve(text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.live_ai_refund(text, text, integer) from public, anon, authenticated;
grant execute on function public.live_ai_reserve(text, text, integer, integer, integer) to service_role;
grant execute on function public.live_ai_refund(text, text, integer) to service_role;
