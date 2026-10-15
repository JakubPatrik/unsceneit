-- Per-frame AI answers, packed: one row per video × filter × minute instead
-- of one row per frame and filter.
--
-- A row's 60 slots are the minute's seconds. Each holds the AI's probability
-- that the answer is yes, × 1000 (0–1000), or -1 when the AI refused (counts
-- as flagged), or null when that second hasn't been analysed for the filter.
-- A 2-hour film with 6 filters is 720 rows of about 200 bytes, instead of
-- 43,200 rows with a header and index entry each. A row stays small enough to
-- be stored inline and rewritten cheaply when live AI fills in a second.
--
-- Whether a second is flagged is decided when it's read, against
-- flag_threshold(). So changing the threshold is one function change: no
-- data rewrite and no AI.

drop table public.frame_results;

create table public.frame_scans (
  video_id   uuid not null references public.videos (id) on delete cascade,
  filter_id  uuid not null references public.content_filters (id) on delete cascade,
  minute     integer not null check (minute >= 0),
  -- probs[i] is second minute * 60 + i - 1.
  probs      smallint[] not null
             check (array_lower(probs, 1) = 1 and array_length(probs, 1) = 60
                    and -1 <= all (probs) and 1000 >= all (probs)),
  model      text not null, -- the model that last answered in this minute
  updated_at timestamptz not null default now(),
  primary key (video_id, filter_id, minute)
);

create index frame_scans_filter_id_idx on public.frame_scans (filter_id);

alter table public.frame_scans enable row level security;

-- Visible when their filter is (a built-in, or the viewer's own).
create policy "Scans of visible filters" on public.frame_scans
  for select to anon, authenticated
  using (exists (
    select 1 from public.content_filters f
    where f.id = filter_id
      and (public.is_admin_user(f.user_id) or f.user_id = (select auth.uid()))
  ));
create policy "Admins write" on public.frame_scans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.frame_scans from anon, authenticated;
grant select on public.frame_scans to anon, authenticated;
grant insert, update, delete on public.frame_scans to authenticated;

-- ---- Threshold ----

-- A second is flagged for a filter when its probability × 1000 is at least
-- this, or the AI refused. The only copy: classify-frames reads it too.
create function public.flag_threshold()
returns smallint
language sql
immutable
parallel safe
as $$ select 500::smallint $$;

-- ---- Writing (classify-frames) ----

-- Slot-wise merge: the new value where there is one, else the old one.
create function public.merge_probs(p_old smallint[], p_new smallint[])
returns smallint[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array_agg(coalesce(x.n, x.o) order by x.i)
  from unnest(p_old, p_new) with ordinality as x (o, n, i);
$$;

-- Saves answers: p_frames = [{filter_id, s, p}], s = whole second, p =
-- probability × 1000 or -1 (refused). One statement: each affected minute
-- row is created or has its slots filled in, keeping the slots it already
-- had. Re-analysed seconds are overwritten. Concurrent saves to the same row
-- queue on its lock, so none is lost.
create function public.save_frame_probs(p_video_id uuid, p_model text, p_frames jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.frame_scans as fs (video_id, filter_id, minute, probs, model)
  select p_video_id, c.filter_id, c.minute,
         array(select (c.slots ->> i::text)::smallint from generate_series(1, 60) as i),
         p_model
  from (
    select (f ->> 'filter_id')::uuid as filter_id,
           (f ->> 's')::int / 60 as minute,
           jsonb_object_agg(((f ->> 's')::int % 60 + 1)::text, f -> 'p') as slots
    from jsonb_array_elements(p_frames) as f
    group by 1, 2
  ) c
  on conflict (video_id, filter_id, minute) do update
  set probs = public.merge_probs(fs.probs, excluded.probs),
      model = excluded.model,
      updated_at = now();
$$;

-- ---- Reading ----

-- Same signature and output as before: a video's analysed seconds as merged
-- ranges per filter. Each second [s, s + 1) is widened by p_pad on both sides
-- (start clamped at 0); overlapping or touching ranges merge
-- (gaps-and-islands). p_flagged: only flagged seconds (the scenes to hide),
-- else every analysed second (what's scanned).
create or replace function public.frame_ranges(p_video_id uuid, p_flagged boolean, p_pad double precision default 0)
returns table (filter_id uuid, start_s double precision, end_s double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with seconds as (
    select fs.filter_id, fs.minute * 60 + x.i - 1 as s
    from public.frame_scans fs,
         unnest(fs.probs) with ordinality as x (p, i)
    where fs.video_id = p_video_id
      and x.p is not null
      and (not p_flagged or x.p = -1 or x.p >= public.flag_threshold())
  ),
  spans as (
    select filter_id, greatest(0, s - p_pad) as start_s, s + 1 + p_pad as end_s
    from seconds
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

-- ---- Function grants ----
revoke all on function public.flag_threshold(), public.merge_probs(smallint[], smallint[]),
  public.save_frame_probs(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.flag_threshold() to anon, authenticated, service_role;
-- Writes: the service role (classify-frames); admins via RLS.
grant execute on function public.merge_probs(smallint[], smallint[]), public.save_frame_probs(uuid, text, jsonb)
  to authenticated, service_role;
