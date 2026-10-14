-- frame_scans.model isn't used by anything: drop it, and the parameter that
-- filled it.

drop function public.save_frame_probs(uuid, text, jsonb);
alter table public.frame_scans drop column model;

-- Saves answers: p_frames = [{filter_id, s, p}], s = whole second, p =
-- probability × 1000 or -1 (refused). One statement: each affected minute
-- row is created or has its slots filled in, keeping the slots it already
-- had. Re-analysed seconds are overwritten. Concurrent saves to the same row
-- queue on its lock, so none is lost.
create function public.save_frame_probs(p_video_id uuid, p_frames jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.frame_scans as fs (video_id, filter_id, minute, probs)
  select p_video_id, c.filter_id, c.minute,
         array(select (c.slots ->> i::text)::smallint from generate_series(1, 60) as i)
  from (
    select (f ->> 'filter_id')::uuid as filter_id,
           (f ->> 's')::int / 60 as minute,
           jsonb_object_agg(((f ->> 's')::int % 60 + 1)::text, f -> 'p') as slots
    from jsonb_array_elements(p_frames) as f
    group by 1, 2
  ) c
  on conflict (video_id, filter_id, minute) do update
  set probs = public.merge_probs(fs.probs, excluded.probs),
      updated_at = now();
$$;

revoke all on function public.save_frame_probs(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_frame_probs(uuid, jsonb) to authenticated, service_role;
