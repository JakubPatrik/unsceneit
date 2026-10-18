// Background worker: fetches Supabase data (cached) for content scripts and
// the popup, and runs the debug modes' frame analysis (dev builds only).

importScripts("config.js", "logic.js");

// Dev-only DEV_SECRET_KEY (written by scripts/dev-setup.sh, gitignored, never
// packaged). Absent in store builds, which is expected.
try {
  importScripts("config.dev.js");
} catch {}

const CACHE_TTL_MS = 5 * 60 * 1000;

function supabaseHeaders() {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY };
  // Legacy anon keys are JWTs and also go in Authorization; new sb_publishable_ keys don't.
  if (SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }
  return headers;
}

async function supabaseFetch(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...supabaseHeaders(), ...init.headers },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

const supabaseGet = (path) => supabaseFetch(path);
const supabaseRpc = (name, args) =>
  supabaseFetch(`rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

// Shared across all frames/tabs so we hit Supabase at most once per TTL.
// Lost when the service worker sleeps, which just means a refetch.
const cache = new Map(); // key -> { at, promise }

function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key)); // retry on next request
  return promise;
}

const getFilters = () =>
  cached("filters", () =>
    supabaseGet("content_filters?select=id,key,label,category,min_age&order=category,sort_order")
  );

// Keep saved filters valid when the worker starts: settings saved before
// filters had ids hold keys ("gore"), and ids of filters that no longer exist
// (e.g. after a database rebuild) match nothing. Map keys to ids, drop the rest.
(async () => {
  const { enabledFilters } = await chrome.storage.sync.get({ enabledFilters: [] });
  if (!enabledFilters.length) return;
  const migrated = migrateEnabledFilters(enabledFilters, await getFilters());
  if (migrated.join() !== enabledFilters.join()) await chrome.storage.sync.set({ enabledFilters: migrated });
})().catch((err) => console.warn("unscene.it: settings migration failed", err));

// Replies to an async message with the result of `promise`, or `fallback` on error.
function respond(promise, sendResponse, fallback) {
  promise.then(sendResponse, (err) => {
    console.warn("unscene.it: Supabase request failed", err);
    sendResponse(fallback);
  });
  return true; // keep the message channel open
}

// ---- Library lookup ----
// Only the playing video is looked up (never the whole library): by YouTube
// id, else by title (find_video, index-backed). If that finds
// nothing (or the wrong video), the user picks it in the dialog's search;
// that choice is remembered per page.

const MAX_MANUAL_MATCHES = 200;

async function getManualMatches() {
  const { manualMatches = {} } = await chrome.storage.local.get("manualMatches");
  return manualMatches; // pageKey → { id, title, at }
}

function lookupVideo({ youtubeId, titles, manualId }) {
  const key = manualId ? `video:${manualId}` : `match:${youtubeId ?? ""}|${titles.join("|")}`;
  return cached(key, () =>
    (manualId
      ? supabaseRpc("video_with_ranges", { p_video_id: manualId })
      : supabaseRpc("find_video", { p_youtube_id: youtubeId ?? null, p_titles: titles })
    ).then(mapLibraryResult)
  );
}

// From a content script whose frame plays a video: { youtubeId, title }.
async function handleLookup(msg, tab) {
  // YouTube: the id only. Page/tab titles can still be the previous video's
  // right after navigating, which would match the wrong library entry.
  const titles = msg.youtubeId ? [] : [...new Set([msg.title, cleanTitle(tab?.title)].filter(Boolean))];
  const manual = tab?.url ? (await getManualMatches())[pageKey(tab.url)] : null;
  return lookupVideo({ youtubeId: msg.youtubeId, titles, manualId: manual?.id });
}

// From the dialog's library search: remember (or, with video = null, forget)
// the user's pick for a page, then tell that tab's frames to look up again.
async function selectVideo({ tabId, pageUrl, video }) {
  const matches = await getManualMatches();
  const key = pageKey(pageUrl);
  if (video) matches[key] = { id: video.id, title: video.title, at: Date.now() };
  else delete matches[key];
  // Keep the newest picks only.
  const kept = Object.entries(matches)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_MANUAL_MATCHES);
  await chrome.storage.local.set({ manualMatches: Object.fromEntries(kept) });
  chrome.tabs.sendMessage(tabId, { type: "library-changed" }).catch(() => {});
}

// ---- Live AI: frame analysis ----
// Live AI calls classify-frames with the publishable key and a random
// per-browser install id: free live AI, charged against a monthly allowance
// (the backend's quota.ts). Dev builds too, so the cap shows and can be
// tested locally; their secret key (config.dev.js) is used only for the debug
// modes' dry runs, which aren't charged.
//
// chrome.storage.local, read by the content scripts and the popup:
//   liveAIAvailable: live AI can run now (the dialog's button, and the
//                    look-ahead's stream mirroring, tee-flag.js)
//   liveAIQuota:     the allowance as last reported (null until the first check)
//   devBuild:        unpacked build with config.dev.js (debug panel)

async function devSecretKey() {
  const self = await chrome.management.getSelf(); // no permission needed
  if (self.installType !== "development") return null;
  return typeof DEV_SECRET_KEY === "string" && DEV_SECRET_KEY ? DEV_SECRET_KEY : null;
}

// Random id for this browser profile (cleared on uninstall). Not tied to the
// viewer in any way; it only counts this browser's free live AI seconds.
async function installId() {
  const { installId } = await chrome.storage.local.get("installId");
  if (installId) return installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

function saveQuota(quota) {
  return chrome.storage.local.set({
    liveAIQuota: quota,
    liveAIQuotaAt: Date.now(),
    liveAIAvailable: liveAIUsable(quota),
  });
}

// POST to classify-frames: dry runs (dev only) with the secret key,
// everything else with the publishable key + install id.
async function classifyFetch(body) {
  const key = body.persist === false ? await devSecretKey() : null;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/classify-frames`, {
    method: "POST",
    headers: { ...(key ? { apikey: key } : supabaseHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(key ? body : { ...body, install_id: await installId() }),
  });
  const data = await res.json().catch(() => ({}));
  if ("quota" in data) await saveQuota(data.quota);
  return { res, data };
}

// The allowance, fresh from the backend (popup open, worker start; the
// month may have rolled over since the last answer).
async function refreshQuota() {
  const { res, data } = await classifyFetch({ quota: true });
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.quota;
}

// The worker wakes often; check at most every 10 minutes, and whenever the
// allowance should have refilled.
const QUOTA_RECHECK_MS = 10 * 60 * 1000;
devSecretKey().then(async (key) => {
  chrome.storage.local.set({ devBuild: !!key });
  const { liveAIQuota, liveAIQuotaAt = 0 } = await chrome.storage.local.get(["liveAIQuota", "liveAIQuotaAt"]);
  const refilled = liveAIQuota && Date.now() >= Date.parse(liveAIQuota.resets_at);
  if (!refilled && Date.now() - liveAIQuotaAt < QUOTA_RECHECK_MS) return;
  await refreshQuota();
}).catch((err) => console.warn("unscene.it: couldn't check live AI minutes", err));

// Sends captured frames ({ t, image }[]) to classify-frames and returns
// per-frame decisions plus flagged ranges.
//   - Live AI (persist: true, video: { title, youtubeId }): analyses ALL
//     built-in filters and saves the ranges to the library, so the next viewer
//     gets them; the page only blurs the viewer's active filters.
//   - Debug live overlay (persist: false): dry run for the given filterIds.
function isYouTubeUrl(url) {
  try {
    return /(^|\.)youtube(-nocookie)?\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function analyzeFrames({ frames, filterIds, persist = false, video }, tab) {
  // Never save from YouTube without a video id: that's a hover preview on the
  // home or search page (content.js mainVideo ignores those; this is the
  // safety net). It would create a library entry named after the page.
  if (persist && !video?.youtubeId && isYouTubeUrl(tab?.url)) {
    throw new Error("Not saved: YouTube page without a video id (preview or search)");
  }
  // Dry runs (the debug live overlay) are dev-only; free live AI only saves.
  if (!persist && !(await devSecretKey())) {
    throw new Error(
      "Debug analysis needs an unpacked build with config.dev.js (run extension/scripts/dev-setup.sh)"
    );
  }
  const started = Date.now();
  const { res, data } = await classifyFetch(
    persist
      ? {
          persist: true,
          interval_s: 1,
          frames,
          video: {
            title: video?.title || cleanTitle(tab?.title) || "Untitled video",
            youtube_id: video?.youtubeId ?? null,
          },
        }
      : { persist: false, interval_s: 1, filter_ids: filterIds, frames }
  );
  if (!res.ok) {
    const err = new Error(data.error ?? data.message ?? `HTTP ${res.status}`);
    err.code = data.code; // "live_ai_limit": the free minutes are used up
    err.quota = data.quota;
    throw err;
  }
  // Saved: the library's ranges and scanned stretches changed, so the next
  // lookup (e.g. after a reload) must see them rather than a cached answer.
  if (persist) for (const k of cache.keys()) if (k !== "filters") cache.delete(k);
  return {
    filters: data.filters, // [{ id, key, label }] for display
    decisions: data.decisions,
    ranges: data.ranges,
    mock: data.mock,
    quota: data.quota ?? null,
    ms: Date.now() - started,
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get-filters") {
    return respond(getFilters().then((filters) => ({ filters })), sendResponse, {
      filters: [],
    });
  }

  if (msg.type === "lookup-video") {
    return respond(handleLookup(msg, sender.tab), sendResponse, { video: null, ranges: [] });
  }

  if (msg.type === "search-videos") {
    return respond(supabaseRpc("search_videos", { p_query: msg.query }), sendResponse, []);
  }

  // From the in-page "not in the library" panel: pick for the sender's tab.
  if (msg.type === "pick-video-here") {
    const tab = sender.tab;
    return respond(
      selectVideo({ tabId: tab.id, pageUrl: tab.url, video: msg.video }).then(() => ({ ok: true })),
      sendResponse,
      { ok: false }
    );
  }

  if (msg.type === "analyze-frames") {
    analyzeFrames(msg, sender.tab).then(
      (result) => sendResponse({ ok: true, ...result }),
      (err) => sendResponse({ ok: false, error: err.message, code: err.code, quota: err.quota })
    );
    return true; // async response
  }

  // From the popup: the free live AI allowance, fresh.
  if (msg.type === "get-live-quota") {
    refreshQuota().then(
      (quota) => sendResponse({ ok: true, quota }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true;
  }
});
