-- SceneMod schema, part 1: admins and content filters (built-in +
-- user-created). The video library (videos, per-frame AI results) is in
-- 20261014100000_video_library.sql.
--
-- Built-in filters and the shared library are curated by admin accounts
-- (public.admins). Signed-in users can add their own trigger filters. AI
-- results point at a filter by id, so different users' filters may share a key.

-- ---- Admins ----

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.admins (user_id) values ('27507de5-a60a-4089-9969-3be4382b7f97');

-- SECURITY DEFINER so access policies can check admin status without giving
-- clients read access to the admins table.
create function public.is_admin_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = uid);
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin_user((select auth.uid()));
$$;

-- ---- Content filters (PRD §2) ----
-- The presets a user can turn on, and the prompt the Decisions API answers (as
-- a yes/no predicate) for each video frame. Built-ins are owned by an admin;
-- every other filter is private to the user who created it.

create table public.content_filters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text not null, -- slug, unique per owner (e.g. 'gore')
  label      text not null,
  -- Yes/no question asked about each frame. Server-only (see grants below).
  prompt     text not null,
  category   text not null check (category in ('age', 'trigger')),
  -- Age filters only: content tagged with this is unsuitable below this age.
  -- Protecting an under-N viewer skips every age filter with min_age >= N.
  min_age    integer check ((category = 'age') = (min_age is not null)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

create index content_filters_user_id_idx on public.content_filters (user_id);

-- Built-in presets, owned by the admin account.
insert into public.content_filters (user_id, key, label, category, min_age, sort_order, prompt) values
  ('27507de5-a60a-4089-9969-3be4382b7f97', 'rated_12', '12+ content', 'age', 12, 10,
   'Does this movie frame show content unsuitable for children under 12, such as moderate violence, frightening or disturbing imagery, or sexual innuendo?'),
  ('27507de5-a60a-4089-9969-3be4382b7f97', 'rated_15', '15+ content', 'age', 15, 20,
   'Does this movie frame show content unsuitable for viewers under 15, such as strong violence, drug use, partial nudity, or sexual activity?'),
  ('27507de5-a60a-4089-9969-3be4382b7f97', 'rated_18', '18+ / mature', 'age', 18, 30,
   'Does this movie frame show adult-only content, such as explicit sexual activity, full nudity, or graphic violence?'),
  ('27507de5-a60a-4089-9969-3be4382b7f97', 'spiders', 'Spiders & insects', 'trigger', null, 10,
   'Does this movie frame show a spider, insect, or other creepy-crawly (real or realistic), even if small or only partly visible?'),
  ('27507de5-a60a-4089-9969-3be4382b7f97', 'heights', 'Extreme heights', 'trigger', null, 20,
   'Does this movie frame show an extreme height from a precarious viewpoint, such as looking down from a cliff edge or skyscraper ledge, or a person dangling or about to fall from a great height?'),
  ('27507de5-a60a-4089-9969-3be4382b7f97', 'gore', 'Blood & gore', 'trigger', null, 30,
   'Does this movie frame show blood, open wounds, serious injuries, mutilation, or other gore?'),
  ('27507de5-a60a-4089-9969-3be4382b7f97', 'inappropriate', 'Sensual & revealing content', 'trigger', null, 40,
   'Does this movie frame show sexualized or immodest content? Answer yes for any of: nudity or sexual activity (all 18+ material); kissing, flirting or seductive moments with a sexual undertone; revealing outfits such as bikinis, swimwear, lingerie, underwear, or very short, sheer or tight clothing; visible cleavage or a lot of bare skin; camera framing that sexualizes a woman''s or a man''s body, such as lingering on the buttocks, chest, hips or crotch; and suggestive dancing such as twerking, butt-shaking or provocative music-video choreography. Answer no for modestly dressed people in non-sexual situations.');

-- ---- Access ----

alter table public.admins enable row level security;
alter table public.content_filters enable row level security;

-- admins: a signed-in user can check whether they are one.
create policy "Own admin row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- content_filters: everyone sees built-ins; signed-in users also see, add,
-- edit and delete their own trigger filters. Admins manage everything.
create policy "Built-in or own" on public.content_filters
  for select to anon, authenticated
  using (public.is_admin_user(user_id) or user_id = (select auth.uid()));
create policy "Add own trigger filters" on public.content_filters
  for insert to authenticated
  with check ((user_id = (select auth.uid()) and category = 'trigger') or public.is_admin());
create policy "Edit own trigger filters" on public.content_filters
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check ((user_id = (select auth.uid()) and category = 'trigger') or public.is_admin());
create policy "Delete own filters" on public.content_filters
  for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Grants (Supabase auto-grants everything on new tables; start from nothing).
revoke all on public.admins, public.content_filters from anon, authenticated;
grant select on public.admins to authenticated;
-- Prompts stay server-side: clients can't read them, only write their own.
-- user_id isn't writable: it always defaults to the caller (auth.uid()).
grant select (id, user_id, key, label, category, min_age, sort_order, created_at)
  on public.content_filters to anon, authenticated;
grant insert (key, label, prompt, category, min_age, sort_order),
      update (key, label, prompt, category, min_age, sort_order),
      delete
  on public.content_filters to authenticated;
