-- Fast video lookup: index-backed matching by YouTube id or page title.
--
-- Replaces per-row regex patterns (match_pattern), which forced a full table
-- scan on every lookup — and lookups that miss are the common case. Titles
-- are now normalized into title_norm and matched through indexes:
--   1. youtube_id            → unique btree index
--   2. exact normalized title → btree index on title_norm
--   3. library title inside the page title ("sintel" in "sintel open movie
--      by blender") → pg_trgm GIN index, word similarity
-- Search uses the same trigram index.

create extension if not exists pg_trgm with schema extensions;

-- Dependents of match_pattern go first.
drop function public.match_video(text, text[]);
drop function public.search_videos(text);

-- "(3) Sintel: Open Movie!" → "3 sintel open movie". Lowercase, every run of
-- non-alphanumerics becomes one space, trimmed. IMMUTABLE so it can back a
-- generated column and its indexes.
create function public.normalize_title(p_title text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(lower(coalesce(p_title, '')), '[^[:alnum:]]+', ' ', 'g'));
$$;

alter table public.videos
  drop constraint videos_identifiable,
  drop constraint videos_match_pattern_valid,
  drop column match_pattern,
  add column title_norm text generated always as (public.normalize_title(title)) stored,
  add constraint videos_title_present check (title_norm <> '');

create index videos_title_norm_idx on public.videos (title_norm);
create index videos_title_norm_trgm_idx on public.videos using gin (title_norm extensions.gin_trgm_ops);

-- ---- Lookup ----
-- Best library match for what's playing; returns at the first hit (cheapest
-- first). p_titles: candidate titles (frame and tab title). Null when nothing
-- matches. SECURITY INVOKER: RLS still decides which ranges come back.
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
begin
  -- 1. YouTube id (unique index).
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

  -- 2. Exact normalized title (btree index).
  select id into v_id
  from public.videos
  where title_norm = any (v_titles)
  order by priority desc
  limit 1;
  if found then
    return public.video_with_ranges(v_id);
  end if;

  -- 3. The library title appears (near-exactly) inside a page title, e.g.
  --    "sintel" in "sintel open movie by blender" (trigram GIN index via <%).
  --    Very short titles are skipped: "up" would match far too much.
  select v.id into v_id
  from unnest(v_titles) as q(title)
  join public.videos v
    on v.title_norm operator(extensions.<%) q.title
   and length(v.title_norm) >= 4
   and extensions.word_similarity(v.title_norm, q.title) >= 0.8
  order by extensions.word_similarity(v.title_norm, q.title) desc,
           length(v.title_norm) desc,
           v.priority desc
  limit 1;
  if found then
    return public.video_with_ranges(v_id);
  end if;

  return null;
end;
$$;

-- Library search for the manual pick (popup / in-page panel): titles that
-- contain the query, best match first (trigram GIN index). The normalized
-- query has no LIKE wildcards, so it needs no escaping.
create function public.search_videos(p_query text)
returns table (id uuid, title text, youtube_id text)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.title, v.youtube_id
  from public.videos v,
       lateral (select public.normalize_title(p_query) as q) n
  where n.q <> ''
    and (v.title_norm like '%' || n.q || '%' or v.title_norm operator(extensions.%) n.q)
  order by extensions.similarity(v.title_norm, n.q) desc, v.title
  limit 10;
$$;

-- ---- Indexing (classify-frames) ----
-- The video for a title + optional YouTube id: by youtube_id, else exact
-- normalized title, else a new row. Returns its id.
create function public.upsert_video(p_title text, p_youtube_id text default null)
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
  end if;
  if v_id is null then
    select id into v_id
    from public.videos
    where title_norm = public.normalize_title(p_title)
      and (p_youtube_id is null or youtube_id is null)
    order by priority desc
    limit 1;
    -- Remember the YouTube id on an existing title-only video.
    if v_id is not null and p_youtube_id is not null then
      update public.videos set youtube_id = p_youtube_id where id = v_id;
    end if;
  end if;
  if v_id is null then
    insert into public.videos (title, youtube_id) values (p_title, p_youtube_id) returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---- Grants ----
revoke all on function public.normalize_title(text), public.find_video(text, text[]),
  public.search_videos(text), public.upsert_video(text, text)
  from public, anon, authenticated;
grant execute on function public.normalize_title(text), public.find_video(text, text[]),
  public.search_videos(text) to anon, authenticated;
grant execute on function public.upsert_video(text, text) to authenticated, service_role;
