-- upsert_video: the YouTube id is authoritative, and titles only change when
-- they're canonical (fetched from YouTube by classify-frames).
--
-- Before: titles came from the page (document.title). YouTube updates the URL
-- before the title when moving to the next video, so live AI saved the new
-- video's id with the previous video's title, and the "found" dialog showed
-- the wrong name.

drop function public.upsert_video(text, text);

create function public.upsert_video(
  p_title text,
  p_youtube_id text default null,
  p_title_is_canonical boolean default false -- true: p_title came from YouTube itself
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
    -- Known video: keep it, fixing its title if we have the real one.
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

revoke all on function public.upsert_video(text, text, boolean) from public, anon, authenticated;
grant execute on function public.upsert_video(text, text, boolean) to authenticated, service_role;
