-- Flagged scenes are padded by 0.5 s on each side instead of 1 s: tighter
-- around the actual scene, so less of the video around it is blurred. A
-- single clean second between two flagged ones is still covered (the two
-- padded ranges touch and merge), so a scene doesn't blink back on for one
-- sample. The extension pads live AI ranges the same (prescan.js
-- PRESCAN_BLUR_PAD_S).
--
-- Only the padding changes: ranges are derived from frame_scans when a video
-- is read, so no stored data is rewritten. Existing grants are kept.

create or replace function public.skip_padding_s()
returns double precision
language sql
immutable
parallel safe
as $$ select 0.5::double precision $$;
