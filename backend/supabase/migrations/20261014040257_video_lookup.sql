-- Per-video library lookup (instead of clients downloading the whole
-- library), manual selection via search, and atomic re-indexing.

-- ---- Video identity ----
-- A video is found by its YouTube id, or by matching the page/video title
-- against match_pattern. At least one of the two must be set.

alter table public.videos
  add column youtube_id text unique check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  alter column match_pattern drop not null,
  add constraint videos_identifiable check (youtube_id is not null or match_pattern is not null),
  -- Compiling the pattern raises "invalid regular expression" for a bad one,
  -- so it can't be stored (and can't break lookups for everyone).
  add constraint videos_match_pattern_valid
    check (match_pattern is null or (match_pattern <> '' and ('' ~* match_pattern) is not null));

-- ---- Lookups (clients) ----
-- SECURITY INVOKER: RLS applies, so callers only get ranges of filters they
-- may see (built-ins, plus their own once signed in).

-- One video with its ranges: { video: {id, title, youtube_id}, ranges: [{start_s, end_s, filter_id, key}] }
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
      from public.skip_ranges r
      join public.content_filters f on f.id = r.filter_id
      where r.video_id = v.id
    ), '[]'::jsonb))
  from public.videos v
  where v.id = p_video_id;
$$;

-- Best library match for what's playing: the YouTube id first, then any of
-- the given titles against match_pattern (highest priority wins). Null when
-- nothing matches.
create function public.match_video(p_youtube_id text default null, p_titles text[] default '{}')
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.video_with_ranges(m.id)
  from (
    select v.id, 0 as kind, v.priority
    from public.videos v
    where p_youtube_id is not null and v.youtube_id = p_youtube_id
    union all
    select v.id, 1 as kind, v.priority
    from public.videos v
    where v.match_pattern is not null
      and exists (select 1 from unnest(p_titles) as t(title) where t.title <> '' and t.title ~* v.match_pattern)
    order by kind, priority desc
    limit 1
  ) m;
$$;

-- Library search for manual selection in the popup (title contains query).
create function public.search_videos(p_query text)
returns table (id uuid, title text, youtube_id text)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.title, v.youtube_id
  from public.videos v
  where v.title ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by v.title
  limit 10;
$$;

-- ---- Re-indexing (classify-frames) ----
-- Atomically replaces a video's ranges for the given filters inside the
-- re-analysed window [p_from, p_to): old ranges there are removed (parts
-- sticking out of the window are kept), then the new ranges are inserted.

create function public.replace_skip_ranges(
  p_video_id uuid,
  p_filter_ids uuid[],
  p_from double precision,
  p_to double precision,
  p_ranges jsonb -- [{filter_id, start_s, end_s}]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Keep the parts of overlapping old ranges that lie outside the window.
  insert into public.skip_ranges (video_id, filter_id, start_s, end_s)
  select video_id, filter_id, start_s, p_from
  from public.skip_ranges
  where video_id = p_video_id and filter_id = any (p_filter_ids) and start_s < p_from and end_s > p_from
  union all
  select video_id, filter_id, p_to, end_s
  from public.skip_ranges
  where video_id = p_video_id and filter_id = any (p_filter_ids) and start_s < p_to and end_s > p_to;

  -- Remove everything that overlaps the window (the pieces above only touch it).
  delete from public.skip_ranges
  where video_id = p_video_id and filter_id = any (p_filter_ids) and start_s < p_to and end_s > p_from;

  insert into public.skip_ranges (video_id, filter_id, start_s, end_s)
  select p_video_id, (r ->> 'filter_id')::uuid, (r ->> 'start_s')::double precision, (r ->> 'end_s')::double precision
  from jsonb_array_elements(p_ranges) as r;
end;
$$;

-- ---- Grants ----
-- Supabase grants new functions to anon/authenticated by default; start from nothing.
revoke all on function public.video_with_ranges(uuid), public.match_video(text, text[]),
  public.search_videos(text), public.replace_skip_ranges(uuid, uuid[], double precision, double precision, jsonb)
  from public, anon, authenticated;
grant execute on function public.video_with_ranges(uuid), public.match_video(text, text[]),
  public.search_videos(text) to anon, authenticated;
-- Writes: the service role (classify-frames); admins via RLS.
grant execute on function public.replace_skip_ranges(uuid, uuid[], double precision, double precision, jsonb)
  to authenticated, service_role;
