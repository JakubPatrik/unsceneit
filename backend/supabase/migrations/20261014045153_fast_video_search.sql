-- Fast library search (manual pick in the popup / in-page panel).
-- Full-text search with word-prefix matching on a GIN index: "tears ste"
-- finds "Tears of Steel" in any word order. Trigram similarity (typos) only
-- runs when full-text search finds nothing, because it rechecks many rows.

alter table public.videos
  -- From title, not title_norm: a generated column can't use another one.
  add column title_tsv tsvector generated always as (to_tsvector('simple', public.normalize_title(title))) stored;

create index videos_title_tsv_idx on public.videos using gin (title_tsv);

create or replace function public.search_videos(p_query text)
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

  -- Nothing matched word-wise: fall back to similar-looking titles (typos).
  return query
    select v.id, v.title, v.youtube_id
    from public.videos v
    where v.title_norm operator(extensions.%) v_q
    order by extensions.similarity(v.title_norm, v_q) desc, v.title
    limit 10;
end;
$$;
