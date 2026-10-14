-- replace_skip_ranges now also merges overlapping/touching ranges of the
-- affected filters. Live AI writes about one second at a time, which would
-- otherwise leave a long scene as hundreds of 1-second rows.

create or replace function public.replace_skip_ranges(
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

  -- Merge overlapping or touching ranges per filter (gaps-and-islands): a
  -- range starts a new island only if it begins after everything before it
  -- has ended. Islands with several rows become one row.
  create temporary table merged_islands on commit drop as
  with ordered as (
    select id, filter_id, start_s, end_s,
           max(end_s) over (partition by filter_id order by start_s, end_s
                            rows between unbounded preceding and 1 preceding) as prev_end
    from public.skip_ranges
    where video_id = p_video_id and filter_id = any (p_filter_ids)
  ),
  islands as (
    select *, sum(case when prev_end is null or start_s > prev_end then 1 else 0 end)
                over (partition by filter_id order by start_s, end_s) as island
    from ordered
  )
  select filter_id, min(start_s) as start_s, max(end_s) as end_s, array_agg(id) as ids
  from islands
  group by filter_id, island
  having count(*) > 1;

  delete from public.skip_ranges
  where id in (select unnest(ids) from merged_islands);

  insert into public.skip_ranges (video_id, filter_id, start_s, end_s)
  select p_video_id, filter_id, start_s, end_s from merged_islands;

  drop table merged_islands;
end;
$$;
