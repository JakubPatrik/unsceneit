-- SceneMod schema, part 2: the video library.
--
--   videos         one row per video, found by YouTube id or title
--   frame_results  the AI's answer per video × frame time × filter: the
--                  single source of truth. Flagged scenes and what has been
--                  scanned are both derived from it when a video is read.
--
-- Classify-frames checks frame_results before calling the AI: a frame that
-- already has a result for every filter costs nothing. A filter added later
-- has no results yet, so frames are analysed again for it. Re-flagging with a
-- new threshold needs no AI either (see `flagged` below).

create extension if not exists pg_trgm with schema extensions;

-- ---- Titles ----

-- "(3) Sintel: Open Movie!" → "3 sintel open movie". Lowercase, every run of
-- non-alphanumerics becomes one space, trimmed. IMMUTABLE so it can back
-- generated columns and their indexes.
create function public.normalize_title(p_title text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(coalesce(p_title, '')), '[^[:alnum:]]+', ' ', 'g'));
$$;

-- "tears of steel blender" → {tears, tears of, tears of steel, …, of, of steel, …}:
-- every run of up to p_max_words consecutive words.
create function public.title_spans(p_norm text, p_max_words int default 12)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(array_to_string(w.words[s:e], ' ')), '{}')
  from (select string_to_array(nullif(p_norm, ''), ' ') as words) w,
       generate_series(1, coalesce(array_length(w.words, 1), 0)) as s,
       generate_series(s, least(s + p_max_words - 1, array_length(w.words, 1))) as e;
$$;

-- ---- Tables ----

create table public.videos (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  youtube_id text unique check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- Higher wins when several videos match a title.
  priority   integer not null default 0,
  title_norm text generated always as (public.normalize_title(title)) stored,
  -- From title, not title_norm: a generated column can't use another one.
  title_tsv  tsvector generated always as (to_tsvector('simple', public.normalize_title(title))) stored,
  created_at timestamptz not null default now(),
  constraint videos_title_present check (title_norm <> '')
);

create index videos_title_norm_idx on public.videos (title_norm);
create index videos_title_norm_trgm_idx on public.videos using gin (title_norm extensions.gin_trgm_ops);
create index videos_title_tsv_idx on public.videos using gin (title_tsv);

create table public.frame_results (
  video_id    uuid not null references public.videos (id) on delete cascade,
  filter_id   uuid not null references public.content_filters (id) on delete cascade,
  -- Frame time in seconds. The frame stands for [t, t + interval_s): the
  -- stretch until the next sample.
  t           double precision not null check (t >= 0),
  interval_s  double precision not null default 1 check (interval_s > 0),
  -- The AI's probability that the answer is yes; null = it refused to answer.
  probability real check (probability between 0 and 1),
  -- Whether the frame counts as flagged for this filter: probability at or
  -- above the threshold when saved, or refused. To re-flag with another
  -- threshold, no AI needed:
  --   update public.frame_results set flagged = probability is null or probability >= 0.6;
  -- Admins can also correct single frames by hand.
  flagged     boolean not null,
  model       text not null, -- which model answered (rescan when it changes)
  created_at  timestamptz not null default now(),
  primary key (video_id, filter_id, t)
);

create index frame_results_filter_id_idx on public.frame_results (filter_id);

-- ---- Access ----

alter table public.videos enable row level security;
alter table public.frame_results enable row level security;

-- videos: one public library, curated by admins (and classify-frames, which
-- uses the service role and bypasses RLS).
create policy "Public read" on public.videos
  for select to anon, authenticated using (true);
create policy "Admins write" on public.videos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- frame_results: visible when their filter is (a built-in, or the viewer's own).
create policy "Results of visible filters" on public.frame_results
  for select to anon, authenticated
  using (exists (
    select 1 from public.content_filters f
    where f.id = filter_id
      and (public.is_admin_user(f.user_id) or f.user_id = (select auth.uid()))
  ));
create policy "Admins write" on public.frame_results
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Supabase auto-grants everything on new tables; start from nothing.
revoke all on public.videos, public.frame_results from anon, authenticated;
grant select on public.videos, public.frame_results to anon, authenticated;
grant insert, update, delete on public.videos, public.frame_results to authenticated;

-- ---- Derived ranges ----

-- Safety buffer around flagged scenes, in seconds: a scene can start or end
-- between two samples. With a buffer of at least half the sampling interval,
-- a single clean frame between two flagged ones is also covered, so a scene
-- doesn't flicker back on for one sample.
create function public.skip_padding_s()
returns double precision
language sql
immutable
parallel safe
as $$ select 1.0::double precision $$;

-- A video's frames as merged time ranges per filter: each frame's
-- [t, t + interval_s), widened by p_pad on both sides (start clamped at 0),
-- with overlapping or touching ranges merged (gaps-and-islands). p_flagged:
-- only flagged frames (the scenes to hide), else every frame (what's scanned).
create function public.frame_ranges(p_video_id uuid, p_flagged boolean, p_pad double precision default 0)
returns table (filter_id uuid, start_s double precision, end_s double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with spans as (
    select fr.filter_id,
           greatest(0, fr.t - p_pad) as start_s,
           fr.t + fr.interval_s + p_pad as end_s
    from public.frame_results fr
    where fr.video_id = p_video_id and (fr.flagged or not p_flagged)
  ),
  ordered as (
    select *, max(end_s) over (partition by filter_id order by start_s, end_s
                               rows between unbounded preceding and 1 preceding) as prev_end
    from spans
  ),
  islands as (
    select *, sum(case when prev_end is null or start_s > prev_end then 1 else 0 end)
                over (partition by filter_id order by start_s, end_s) as island
    from ordered
  )
  select filter_id, min(start_s), max(end_s)
  from islands
  group by filter_id, island;
$$;

-- One video for the extension:
-- { video: {id, title, youtube_id},
--   ranges:  [{start_s, end_s, filter_id, key}]   flagged scenes, padded
--   scanned: [{start_s, end_s, filter_id}] }      analysed, flagged or not
-- SECURITY INVOKER: RLS limits both to filters the caller may see.
create function public.video_with_ranges(p_video_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'video', jsonb_build_object('id', v.id, 'title', v.title, 'youtube_id', v.youtube_id),
    'ranges', coalesce((
      select jsonb_agg(
        jsonb_build_object('start_s', r.start_s, 'end_s', r.end_s, 'filter_id', r.filter_id, 'key', f.key)
        order by r.start_s)
      from public.frame_ranges(v.id, true, public.skip_padding_s()) r
      join public.content_filters f on f.id = r.filter_id
    ), '[]'::jsonb),
    'scanned', coalesce((
      select jsonb_agg(
        jsonb_build_object('start_s', s.start_s, 'end_s', s.end_s, 'filter_id', s.filter_id)
        order by s.start_s)
      from public.frame_ranges(v.id, false) s
    ), '[]'::jsonb))
  from public.videos v
  where v.id = p_video_id;
$$;

-- ---- Lookup and search (clients) ----

-- Best library match for what's playing (video_with_ranges), or null. Returns
-- at the first hit, cheapest first:
--   1. YouTube id (unique index);
--   2. exact normalized title (btree index);
--   3. a library title that's a run of words inside a page title, e.g.
--      "tears of steel" in "tears of steel blender open movie 4k": one btree
--      probe per span. Longest wins; spans under 4 characters are skipped
--      ("up" would match far too much).
create function public.find_video(p_youtube_id text default null, p_titles text[] default '{}')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_titles text[];
  v_spans text[];
begin
  if p_youtube_id is not null then
    select id into v_id from public.videos where youtube_id = p_youtube_id;
    if found then
      return public.video_with_ranges(v_id);
    end if;
  end if;

  select array_agg(distinct n) into v_titles
  from (select public.normalize_title(t) as n from unnest(p_titles) as t) s
  where n <> '';
  if v_titles is null then
    return null;
  end if;

  select id into v_id
  from public.videos
  where title_norm = any (v_titles)
  order by priority desc
  limit 1;
  if found then
    return public.video_with_ranges(v_id);
  end if;

  select array_agg(distinct span) into v_spans
  from unnest(v_titles) as t(title), unnest(public.title_spans(t.title)) as span
  where length(span) >= 4;

  select id into v_id
  from public.videos
  where title_norm = any (v_spans)
  order by length(title_norm) desc, priority desc
  limit 1;
  if found then
    return public.video_with_ranges(v_id);
  end if;

  return null;
end;
$$;

-- Library search for the manual pick: full-text search with word prefixes
-- ("tears ste" finds "Tears of Steel" in any word order, GIN index); when
-- that finds nothing, similar-looking titles for typos (trigram index).
create function public.search_videos(p_query text)
returns table (id uuid, title text, youtube_id text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_q text := public.normalize_title(p_query);
  v_ts tsquery;
begin
  if v_q = '' then
    return;
  end if;
  -- Normalized words are alphanumeric only, so they're safe tsquery terms.
  v_ts := to_tsquery('simple',
    array_to_string(array(select w || ':*' from unnest(string_to_array(v_q, ' ')) as w), ' & '));

  return query
    select v.id, v.title, v.youtube_id
    from public.videos v
    where v.title_tsv @@ v_ts
    order by length(v.title_norm), v.title -- shortest (most specific) first
    limit 10;
  if found then
    return;
  end if;

  return query
    select v.id, v.title, v.youtube_id
    from public.videos v
    where v.title_norm operator(extensions.%) v_q
    order by extensions.similarity(v.title_norm, v_q) desc, v.title
    limit 10;
end;
$$;

-- ---- Indexing (classify-frames) ----

-- The video for a title and optional YouTube id, created if new. The YouTube
-- id is authoritative; the title only changes when it's canonical (fetched
-- from YouTube by classify-frames). Page titles can still be the previous
-- video's right after YouTube navigates, so they never overwrite one.
create function public.upsert_video(
  p_title text,
  p_youtube_id text default null,
  p_title_is_canonical boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_youtube_id is not null then
    select id into v_id from public.videos where youtube_id = p_youtube_id;
    if found then
      if p_title_is_canonical then
        update public.videos set title = p_title where id = v_id and title is distinct from p_title;
      end if;
      return v_id;
    end if;
    -- A title-only entry (added without an id) with this exact real title.
    if p_title_is_canonical then
      select id into v_id
      from public.videos
      where youtube_id is null and title_norm = public.normalize_title(p_title)
      order by priority desc
      limit 1;
      if found then
        update public.videos set youtube_id = p_youtube_id where id = v_id;
        return v_id;
      end if;
    end if;
    insert into public.videos (title, youtube_id) values (p_title, p_youtube_id) returning id into v_id;
    return v_id;
  end if;

  -- No YouTube id: exact normalized title, else a new entry.
  select id into v_id
  from public.videos
  where title_norm = public.normalize_title(p_title)
  order by priority desc
  limit 1;
  if v_id is null then
    insert into public.videos (title) values (p_title) returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---- Function grants ----
-- Supabase grants new functions to everyone by default; start from nothing.
revoke all on function
  public.normalize_title(text), public.title_spans(text, int), public.skip_padding_s(),
  public.frame_ranges(uuid, boolean, double precision), public.video_with_ranges(uuid),
  public.find_video(text, text[]), public.search_videos(text), public.upsert_video(text, text, boolean)
  from public, anon, authenticated;
grant execute on function
  public.normalize_title(text), public.title_spans(text, int), public.skip_padding_s(),
  public.frame_ranges(uuid, boolean, double precision), public.video_with_ranges(uuid),
  public.find_video(text, text[]), public.search_videos(text)
  to anon, authenticated, service_role;
-- Writes: the service role (classify-frames); admins via RLS.
grant execute on function public.upsert_video(text, text, boolean) to authenticated, service_role;
