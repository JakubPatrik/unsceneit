-- find_video step 3 ("library title inside a longer page title") via exact
-- word spans instead of trigram word similarity. Benchmarked at 50k videos,
-- `title_norm <% page_title` can't use the GIN index efficiently from that
-- side and timed out. Instead, every run of consecutive words in the page
-- title (up to 12 words) is looked up by exact equality on the title_norm
-- btree index: a few dozen index probes, regardless of library size.

-- "tears of steel blender" → {tears, tears of, tears of steel, …, of, of steel, …}
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

create or replace function public.find_video(p_youtube_id text default null, p_titles text[] default '{}')
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

  -- 3. The library title is a run of words inside a page title, e.g.
  --    "tears of steel" in "tears of steel blender open movie 4k" (btree
  --    index, one probe per span). Longest match wins; spans under 4
  --    characters are skipped ("up" would match far too much).
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

revoke all on function public.title_spans(text, int) from public, anon, authenticated;
grant execute on function public.title_spans(text, int) to anon, authenticated;
