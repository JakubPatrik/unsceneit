-- Feedback from people using or leaving unscene.it. Today that's the page the
-- extension opens when it's removed (website/src/pages/uninstall.tsx).
--
-- Same shape as the waitlist: the website calls submit_feedback() with the
-- publishable key, and nobody can read, change or delete rows through the API.
-- Admins read it in the dashboard (or with the secret key).
--
-- Rows are anonymous unless someone leaves an email for a reply. There's
-- deliberately no install ID: the page can't see it, and feedback stays
-- unlinked from live AI usage.
--
-- Apply this before deploying the website: until then the form can't submit.

create table public.feedback (
  id                uuid primary key default gen_random_uuid(),
  -- Where it came from. A new place to leave feedback adds its value here.
  source            text not null default 'uninstall' check (source in ('uninstall')),
  -- The option picked on the form. Keep in sync with REASONS in
  -- website/src/components/site/feedback-form.tsx.
  reason            text check (reason in (
    'missed_scenes',
    'hid_too_much',
    'not_in_library',
    'live_ai_limit',
    'slow_or_broken',
    'hard_to_use',
    'no_longer_needed',
    'other'
  )),
  message           text check (length(message) <= 2000),
  -- Only if they'd like a reply.
  email             text,
  extension_version text,
  created_at        timestamptz not null default now(),
  constraint feedback_has_content check (reason is not null or message is not null),
  constraint feedback_email_format check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  constraint feedback_extension_version_format check (extension_version ~ '^[0-9]{1,5}(\.[0-9]{1,5}){0,3}$')
);

alter table public.feedback enable row level security;
-- No policies: with RLS on and no grants, the table is closed to API users.
revoke all on public.feedback from anon, authenticated;

-- Adds one piece of feedback and returns nothing, so the API stays write-only.
-- Needs a reason or a message; the table's constraints reject anything else.
create function public.submit_feedback(
  p_reason            text default null,
  p_message           text default null,
  p_email             text default null,
  p_extension_version text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(lower(btrim(p_email)), '');
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  insert into public.feedback (reason, message, email, extension_version)
  values (
    p_reason,
    nullif(btrim(p_message), ''),
    v_email,
    -- Read from the page's address, which anyone can edit. A bad value
    -- shouldn't cost us the feedback, so it's dropped rather than rejected.
    case when p_extension_version ~ '^[0-9]{1,5}(\.[0-9]{1,5}){0,3}$' then p_extension_version end
  );
end;
$$;

-- Supabase grants new functions to everyone by default; start from nothing.
revoke all on function public.submit_feedback(text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_feedback(text, text, text, text) to anon, authenticated, service_role;
