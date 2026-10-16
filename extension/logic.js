// Pure logic shared by the content script, popup and background worker.
// No chrome.* or DOM access, so it can be unit-tested in Node (see tests/).
// Loaded as a classic script in the extension (functions become globals)
// and via require() in tests.

// Seconds → "m:ss.s" (e.g. 62.5 → "1:02.5").
function formatTime(s) {
  s = Math.round(s * 10) / 10; // round first so 59.96 → "1:00.0", not "0:60.0"
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).padStart(4, "0");
  return `${m}:${rest}`;
}

// ---- Lookahead (pre-scan mode) ----
// Frames are sampled at whole seconds; analysed second k stands for [k, k+1).

// First unanalysed second at or after floor(t), i.e. how far ahead playback
// is covered. Returns floor(t) when the current second isn't analysed.
function coveredUntil(analysed, t) {
  let s = Math.floor(t);
  while (analysed.has(s)) s++;
  return s;
}

// Whether playback may continue from `t`: the next `aheadS` seconds are
// analysed. The video's final `tailS` seconds never count: the last partial
// second often can't be captured, and a stall there would hold the video just
// before its end ("Waiting for analysis…" forever). They're still analysed
// when possible.
function screenedEnough(analysed, t, aheadS, duration, tailS = 1) {
  const stop = Number.isFinite(duration) ? duration - tailS : Infinity;
  if (t >= stop) return true;
  return coveredUntil(analysed, t) >= Math.min(t + aheadS, stop);
}

// Next whole second to capture: the earliest in [floor(t), t + lookaheadS)
// that is neither analysed nor in flight and exists in the video, else null.
function nextSampleSecond(analysed, pending, t, lookaheadS, duration) {
  const end = Number.isFinite(duration) ? duration : Infinity;
  const limit = Math.min(t + lookaheadS, end);
  for (let s = Math.floor(t); s < limit; s++) {
    if (!analysed.has(s) && !pending.has(s)) return s;
  }
  return null;
}

// Whole seconds analysed during the initial stall: floor(t) … floor(t)+windowS-1,
// cut off at the end of the video.
function initialWindow(t, windowS, duration) {
  const end = Number.isFinite(duration) ? duration : Infinity;
  const start = Math.floor(t);
  return Array.from({ length: windowS }, (_, i) => start + i).filter((s) => s < end);
}

// Labels (filter keys) of the enabled ranges that, extended `padBeforeS`
// earlier and `padAfterS` later (a scene can start or end between samples),
// contain `t`. Deduped in range order; empty = nothing to hide.
function blurKeysAt(ranges, enabledFilters, t, padBeforeS, padAfterS = 0) {
  const keys = ranges
    .filter((r) => enabledFilters.has(r.filter) && t >= r.start - padBeforeS && t < r.end + padAfterS)
    .map((r) => r.key ?? r.filter);
  return [...new Set(keys)];
}

// ---- Flagged-scene handling (popup setting) ----

// Stored chrome.storage.sync.flaggedHandling → { mute, visual } with defaults
// (mute on, heavy blur). visual: "blur" | "cover" (grey, nothing visible).
function normalizeFlaggedHandling(raw) {
  return {
    mute: typeof raw?.mute === "boolean" ? raw.mute : true,
    visual: raw?.visual === "cover" ? "cover" : "blur",
  };
}

// CSS filter put on the <video> while a flagged scene plays. "cover" also
// gets an opaque grey layer on top; its filter is a fallback if that layer
// can't be shown.
function flaggedVideoFilter(visual) {
  return visual === "cover" ? "blur(100px) grayscale(1) brightness(0.3)" : "blur(60px) brightness(0.55)";
}

// ---- Video identity ----

// Identifies "which video is playing" in a frame. SPAs like YouTube reuse
// the same <video> element (sometimes even the same blob: URL) for the next
// video, so the page URL is part of the key. The #hash is ignored.
function mediaKey(src, pageUrl) {
  return `${src}|${pageUrl.split("#")[0]}`;
}

// ---- Video picking ----

// Smallest video worth filtering; anything smaller is an ad, a preview or
// a thumbnail animation.
const MIN_VIDEO_WIDTH = 200;
const MIN_VIDEO_HEIGHT = 100;

// The one main video among `videos`: the biggest on screen (at least
// MIN_VIDEO_WIDTH × MIN_VIDEO_HEIGHT), whether or not it's playing, so a
// smaller preview or ad that starts playing never takes over. Ties go to the
// first. null when none is big enough.
function pickMainVideo(videos) {
  let best = null;
  let bestArea = 0;
  for (const v of videos) {
    if (v.offsetWidth < MIN_VIDEO_WIDTH || v.offsetHeight < MIN_VIDEO_HEIGHT) continue;
    const area = v.offsetWidth * v.offsetHeight;
    if (area > bestArea) {
      best = v;
      bestArea = area;
    }
  }
  return best;
}

// ---- Library lookup ----

// YouTube video id from a page or embed URL (watch?v=, youtu.be/, /embed/,
// /shorts/, /live/, youtube-nocookie.com), else null.
function youtubeIdFromUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.split("/")[1];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

// Page/tab title → the video's title: drops YouTube's "(3) " notification
// count and " - YouTube" suffix.
function cleanTitle(title) {
  return (title ?? "")
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s+-\s+YouTube$/, "")
    .trim();
}

// The page a manual library choice is remembered for (URL without #hash).
function pageKey(url) {
  return (url ?? "").split("#")[0];
}

// find_video / video_with_ranges RPC result → { video, ranges } with ranges
// in the extension's shape ({ start, end, filter: id, key }). No match →
// { video: null, ranges: [] }.
// scanned: stretches already analysed per filter, flagged or not.
function mapLibraryResult(result) {
  if (!result?.video) return { video: null, ranges: [], scanned: [] };
  return {
    video: result.video,
    ranges: (result.ranges ?? []).map((r) => ({
      start: r.start_s,
      end: r.end_s,
      filter: r.filter_id,
      key: r.key,
    })),
    scanned: (result.scanned ?? []).map((r) => ({ start: r.start_s, end: r.end_s, filter: r.filter_id })),
  };
}

// Whole seconds s whose [s, s + 1) the library has already scanned for every
// one of filterIds: live AI needn't analyse them again (the library's skip
// ranges say what to hide). None without filters.
function scannedSeconds(scanned, filterIds) {
  const seconds = new Set();
  const perFilter = [...filterIds].map((id) => scanned.filter((r) => r.filter === id));
  if (!perFilter.length) return seconds;
  const covered = (ranges, s) => ranges.some((r) => r.start <= s && r.end >= s + 1);
  for (const r of perFilter[0]) {
    for (let s = Math.ceil(r.start); s + 1 <= r.end; s++) {
      if (perFilter.every((ranges) => covered(ranges, s))) seconds.add(s);
    }
  }
  return seconds;
}

// ---- Age presets ----

// Filter ids to enable for an "Under N" choice: every age filter with
// min_age >= N. A null/empty choice ("Off") enables none.
function ageFilterIds(ageFilters, minAge) {
  if (minAge == null || minAge === "") return [];
  return ageFilters.filter((f) => f.min_age >= Number(minAge)).map((f) => f.id);
}

// The "Under N" choice implied by the enabled ids (the strictest enabled
// age filter), or null for "Off".
function selectedAge(ageFilters, enabled) {
  const ages = ageFilters.filter((f) => enabled.has(f.id)).map((f) => f.min_age);
  return ages.length ? Math.min(...ages) : null;
}

// Stored enabledFilters → current filter ids. Settings saved before filters
// had ids hold keys ("gore"), which map to the matching visible filter;
// anything unknown (e.g. a deleted filter) is dropped.
function migrateEnabledFilters(stored, filters) {
  const ids = stored.map(
    (v) => filters.find((f) => f.id === v)?.id ?? filters.find((f) => f.key === v)?.id
  );
  return [...new Set(ids.filter(Boolean))];
}

if (typeof module !== "undefined") {
  module.exports = {
    formatTime,
    coveredUntil,
    screenedEnough,
    nextSampleSecond,
    initialWindow,
    blurKeysAt,
    normalizeFlaggedHandling,
    flaggedVideoFilter,
    mediaKey,
    pickMainVideo,
    youtubeIdFromUrl,
    cleanTitle,
    pageKey,
    mapLibraryResult,
    scannedSeconds,
    ageFilterIds,
    selectedAge,
    migrateEnabledFilters,
  };
}
