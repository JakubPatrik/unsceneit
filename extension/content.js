// Runs in every frame (top page + all iframes), from document_start:
//   - the playback gate: a video plays only after the viewer chooses how to
//     watch it, behind a blurred cover + unscene.it dialog.
// Flagged scenes are hidden (never skipped) by prescan.js. Pure helpers
// (youtubeIdFromUrl, ...) come from logic.js; the cover/dialog UI from
// notice.js.

// ---- Extension lifetime ----
// After the extension is reloaded or updated, scripts already injected into
// open tabs are cut off from it: every chrome.runtime call throws "Extension
// context invalidated". This copy then releases the page (no cover, no blur,
// nothing held) and stops, instead of keeping the video paused forever.
function extensionAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

// ---- Settings ----

// Filter ids the user enabled in the popup. Only ranges tagged with one of
// these are hidden; nothing is hidden until the user picks a preset.
let enabledFilters = new Set();
chrome.storage.sync.get({ enabledFilters: [] }).then((s) => (enabledFilters = new Set(s.enabledFilters)));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.enabledFilters) {
    enabledFilters = new Set(changes.enabledFilters.newValue ?? []);
  }
});

// The filters a viewer can pick (built-ins, plus their own once signed in),
// for the "Your filters" picker in the dialog. Loaded once per page.
let filterList = null; // [{ id, key, label, category, min_age }]
const filterListReady = extensionAlive()
  ? chrome.runtime
      .sendMessage({ type: "get-filters" })
      .then((res) => (filterList = res?.filters ?? []))
      .catch(() => (filterList = []))
  : Promise.resolve((filterList = []));

// Saves the viewer's filter choice from the dialog (same setting as the popup).
function setEnabledFilters(ids) {
  enabledFilters = new Set(ids);
  if (extensionAlive()) chrome.storage.sync.set({ enabledFilters: ids });
}

// "Show live AI debug panel" (dev builds; off by default; debug.js reads it).
let debugPanelOn = false;
chrome.storage.local.get({ showDebugPanel: false }).then((s) => (debugPanelOn = s.showDebugPanel));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.showDebugPanel) debugPanelOn = !!changes.showDebugPanel.newValue;
});

// Live AI (Pro) available? True in dev builds with config.dev.js (set by
// background.js); store users get it with sign-in + credits.
let liveAIAvailable = false;
chrome.storage.local.get({ liveAIAvailable: false }).then((s) => (liveAIAvailable = s.liveAIAvailable));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.liveAIAvailable) liveAIAvailable = !!changes.liveAIAvailable.newValue;
});

// ---- Video identity ----

const ON_YOUTUBE = /(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname);

// The YouTube video this page/frame is about (watch, embed, shorts), or null.
function pageYouTubeId() {
  return ON_YOUTUBE ? youtubeIdFromUrl(location.href) : null;
}

// YouTube's main player box. Watch pages also hold a hidden hover-preview
// player with the same classes, which is never gated.
function youtubePlayer() {
  return document.querySelector(location.pathname.startsWith("/shorts/") ? "#shorts-player" : "#movie_player");
}

function isYouTubeMainVideo(video) {
  const player = youtubePlayer();
  return !!player && player.contains(video);
}

// Which video this is, for lookups, decisions and hiding. On YouTube it's
// the video id from the URL (the player swaps streams in the same element and
// a decision holds for the whole video); elsewhere: stream + page.
function videoKey(video) {
  const youtubeId = pageYouTubeId();
  return youtubeId ? `youtube:${youtubeId}` : mediaKey(video.currentSrc, location.href);
}

// What to send the library lookup. YouTube: the id only. The page title can
// still be the previous video's right after navigating, so it's not used.
function lookupIdentity() {
  const youtubeId = pageYouTubeId();
  return youtubeId ? { youtubeId, title: "" } : { youtubeId: null, title: cleanTitle(document.title) };
}

// ---- Library lookup ----
// Library match per key ({ video, ranges, scanned, error? }) via the background worker:
// by YouTube id, else by title, or the viewer's manual pick.
const library = new Map(); // key → { result: {...} | null, promise }

function lookupLibrary(key, identity) {
  if (!extensionAlive()) {
    const none = { video: null, ranges: [] };
    return { result: none, promise: Promise.resolve(none) };
  }
  let entry = library.get(key);
  if (!entry) {
    entry = { result: null, promise: null };
    entry.promise = chrome.runtime
      .sendMessage({ type: "lookup-video", ...identity })
      .then((res) => res ?? { video: null, ranges: [], error: true })
      .catch(() => ({ video: null, ranges: [], error: true }))
      .then((result) => (entry.result = result));
    library.set(key, entry);
  }
  return entry;
}

// Current match for a video, or null while the lookup is in flight.
function libraryFor(video) {
  return lookupLibrary(videoKey(video), lookupIdentity()).result;
}

// ---- Playback gate ----
// A video plays only after the viewer decides. From the moment it appears
// it's held (paused) under a blurred cover with the unscene.it dialog, which
// first shows "checking…" and then, in place, the choices:
//   - found:     watch with filters | watch without filters
//   - not found: turn on live AI filter (when available) | watch without filters (or pick the
//                video from the library search)
// Each choice removes the cover and starts playback.
//
// YouTube video pages are gated by page (the id in the URL is known before any
// <video> exists) and the cover sits on the player box; a stylesheet keeps the
// player blurred and its play button hidden from first paint, so nothing
// shows through while elements load or swap. Other sites are gated per
// <video>.
//
// gate: { key, state: "checking" | "deciding" | "screening" | "open", result, filtered,
//         anchor: () => Element (what the cover covers),
//         videos: () => <video>[] (what is held),
//         identity (for the lookup), youtube: bool }
// filtered: false = watching without filters (library ranges are ignored).
// screening: live AI chosen; held paused under its loader until the first PRESCAN_WINDOW_S
// seconds are pre-screened, then it plays.
const gates = new Map(); // key → gate
const UNDECIDED = new Set(["checking", "deciding"]);

// Must stay paused: undecided, or live AI still pre-screening.
function isHeld(video) {
  const state = gateForVideo(video)?.state;
  return UNDECIDED.has(state) || state === "screening";
}

function flaggedCount(ranges) {
  return ranges.filter((r) => enabledFilters.has(r.filter)).length;
}

// The gate a <video> belongs to, if any.
function gateForVideo(video) {
  if (video.dataset.unsceneitShadow) return null; // pre-scan's hidden lookahead copy
  if (ON_YOUTUBE) return pageYouTubeId() && isYouTubeMainVideo(video) ? gates.get(videoKey(video)) : null;
  return gates.get(videoKey(video)) ?? null;
}

// Still waiting for the viewer's choice (prescan.js / debug.js hold off).
function isUndecided(video) {
  return UNDECIDED.has(gateForVideo(video)?.state);
}

// -- YouTube hold stylesheet, from first paint: the whole player area (also
// its placeholder while the page boots) is blurred, YouTube's play button is
// hidden, and the player ignores clicks; only the unscene.it dialog works.
const HOLD_ATTR = "unsceneitHold";
const holdStyle = document.createElement("style");
holdStyle.textContent = `
  html[data-unsceneit-hold] #player-placeholder,
  html[data-unsceneit-hold] #player-wrap,
  html[data-unsceneit-hold] ytd-player,
  html[data-unsceneit-hold] #player-container-outer,
  html[data-unsceneit-hold] #movie_player,
  html[data-unsceneit-hold] #shorts-player {
    filter: ${flaggedVideoFilter("blur")} !important;
    pointer-events: none !important;
  }
  html[data-unsceneit-hold] .ytp-large-play-button {
    display: none !important;
  }`;
if (ON_YOUTUBE) document.documentElement.append(holdStyle);

function setYouTubeHold(on) {
  if (on) document.documentElement.dataset[HOLD_ATTR] = "1";
  else delete document.documentElement.dataset[HOLD_ATTR];
}

// -- Inline blur for non-YouTube videos (the cover blurs on top too).
const gateBlurs = new WeakMap(); // video → its previous inline filter

function setGateBlur(video, on) {
  if (on && !gateBlurs.has(video)) {
    gateBlurs.set(video, {
      value: video.style.getPropertyValue("filter"),
      priority: video.style.getPropertyPriority("filter"),
    });
    video.style.setProperty("filter", flaggedVideoFilter("blur"), "important");
  } else if (!on && gateBlurs.has(video)) {
    const prev = gateBlurs.get(video);
    if (prev.value) video.style.setProperty("filter", prev.value, prev.priority);
    else video.style.removeProperty("filter");
    gateBlurs.delete(video);
  }
}

// -- Gate lifecycle

// Starts a gate for a subject ({ key, anchor, videos, identity, youtube }).
// pickedByViewer: the viewer just picked this video (search or popup), so a
// match plays with filters straight away instead of asking again.
function startGate(subject, { pickedByViewer = false } = {}) {
  if (gates.has(subject.key) || !extensionAlive()) return;
  const gate = { ...subject, state: "checking", result: null, filtered: true };
  gates.set(gate.key, gate);
  holdGate(gate);
  lookupLibrary(gate.key, gate.identity).promise.then((result) => {
    if (gates.get(gate.key) !== gate) return; // replaced meanwhile
    gate.result = result;
    if (pickedByViewer && result.video) return decide(gate, { filtered: true, live: screensRestLive(gate) });
    gate.state = "deciding";
    showGate(gate); // switches the dialog in place: loading → choices
  });
}

// Keeps an undecided gate's videos paused + blurred and its cover up.
// Called on start and every 100 ms (YouTube resets players as it loads).
function holdGate(gate) {
  if (gate.youtube) setYouTubeHold(true);
  for (const video of gate.videos()) {
    if (!video) continue;
    if (!video.paused) video.pause();
    if (!gate.youtube) {
      if (video.style.getPropertyValue("filter") !== flaggedVideoFilter("blur")) gateBlurs.delete(video);
      setGateBlur(video, true);
    }
  }
  // Self-heal: the cover + dialog must be up (and in the page) for this gate.
  const mode = gate.state === "checking" || !filterList ? "checking" : "dialog"; // what showGate shows
  if (notice.gateKey !== gate.key || !notice.host?.isConnected || notice.mode !== mode) showGate(gate);
}

// A library video partly scanned by live AI before: watching it with filters
// screens the rest live; the scanned seconds need no AI (prescan.js).
function screensRestLive(gate) {
  return liveAIAvailable && gate.result?.scanned?.length > 0;
}

// Renders the cover + dialog for a gate: loading, or the choices (which need
// the filter list; until it's loaded the loader stays up).
function showGate(gate) {
  notice.gateKey = gate.key;
  const anchor = gate.anchor;
  if (gate.state === "checking" || !filterList) {
    noticeChecking(anchor);
    if (gate.state !== "checking") {
      filterListReady.then(() => {
        if (gates.get(gate.key) === gate && gate.state === "deciding") showGate(gate);
      });
    }
    return;
  }
  const picker = {
    filters: filterList,
    enabled: enabledFilters,
    onFiltersChange: setEnabledFilters,
    // Dev builds (where live AI runs): toggle for the look-ahead's debug panel.
    debugPanel: liveAIAvailable
      ? { on: debugPanelOn, onChange: (on) => extensionAlive() && chrome.storage.local.set({ showDebugPanel: on }) }
      : null,
  };
  // ✕: re-opened from the bot mid-video → cancel (keep the previous choice and
  // resume); first time → watch without filters (never stuck paused).
  const close = gate.previous
    ? { onClose: () => decide(gate, gate.previous), closeTitle: "Close (keep current settings)" }
    : { onClose: () => decide(gate, { filtered: false }), closeTitle: "Close (watch without filters)" };
  if (gate.result.video) {
    const liveRest = screensRestLive(gate);
    noticeFound(anchor, {
      ...picker,
      ...close,
      title: gate.result.video.title,
      ranges: gate.result.ranges,
      liveRest,
      onWithFilters: () => decide(gate, { filtered: true, live: liveRest }),
      onWithout: () => decide(gate, { filtered: false }),
    });
  } else {
    noticeUnmatched(anchor, {
      ...picker,
      ...close,
      error: !!gate.result.error,
      liveAI: liveAIAvailable,
      onLiveAI: () => decide(gate, { filtered: true, live: true }),
      onWatchAnyway: () => decide(gate, { filtered: false }),
      // Picked from the library search: a "with filters" choice; look the
      // pick up again and play with its ranges.
      onPicked: () => restartWithPick(gate),
    });
  }
  notice.gateKey = gate.key;
}

// The viewer chose: remove the cover and start playback.
//   live: the live AI look-ahead (prescan.js) takes over; it holds playback
//   behind its own loader while the first seconds are analysed, then plays.
function decide(gate, { filtered, live = false }) {
  // Re-opened from the bot while live AI was already protecting this video:
  // its look-ahead (results for every filter) is still bound to the video.
  const liveRunning =
    gate.previous?.live && prescan.enabled && gate.videos().includes(prescan.video);
  gate.previous = null; // a new choice replaces whatever the bot's dialog was undoing
  gate.state = "open";
  gate.filtered = filtered;
  gate.live = live;
  const release = () => {
    if (gate.youtube) setYouTubeHold(false);
    for (const video of gate.videos()) if (video) setGateBlur(video, false);
  };
  const play = () => {
    for (const video of gate.videos()) video?.play().catch(() => {});
  };
  // Not (or no longer) live AI: stop the look-ahead, unless the dev pre-scan
  // debug mode keeps it running anyway.
  if (!live && prescan.enabled && debug.mode !== "prescan") prescanSetEnabled(false);
  renderOverlay(); // the debug panel hides while watching without filters

  // Still live: just resume. Results already in hide by the new filters at
  // once; if anything ahead is missing, the look-ahead's own stall holds there.
  if (live && liveRunning) {
    release();
    showBot(gate, { morph: true, say: "Xenia is protecting this video" });
    play();
    return;
  }

  if (live) {
    // Stay paused + blurred under the unscene.it loader while live AI
    // pre-screens the first PRESCAN_WINDOW_S seconds; play as soon as their results are in.
    gate.state = "screening";
    gate.progress = noticeScreening(gate.anchor);
    notice.gateKey = gate.key;
    prescanStartLive({
      onProgress: (text, fraction) => gate.progress?.(text, fraction),
      onReady: (problem) => {
        gate.state = "open";
        gate.progress = null;
        // Live AI can't run here: switch the look-ahead off too, so no loader
        // or analysis is left behind a bot that says it's off.
        if (problem) {
          gate.live = false;
          if (prescan.enabled && debug.mode !== "prescan") prescanSetEnabled(false);
        }
        release();
        showBot(gate, { morph: true, say: problem ? `Xenia is off: ${problem}.` : "Xenia is protecting this video" });
        play();
      },
    });
    return;
  }

  release();
  let say = "Watching without filters. Click me to turn them on.";
  if (filtered && gate.result?.video) {
    const count = flaggedCount(gate.result.ranges);
    say = count > 0 ? `Protected · ${count} scene${count === 1 ? "" : "s"} will be hidden` : "Protected · nothing flagged for your filters";
  } else if (filtered) {
    say = liveAIAvailable
      ? "Not in the library yet, so nothing is filtered. Click me to turn on live AI."
      : "Not in the library yet, so nothing is filtered.";
  }
  showBot(gate, { morph: true, say });
  play();
}

// Xenia, the unscene.it bot, for a decided gate, in the player's top-right corner. Its
// eyes look around while it's actually filtering; she rests (grey) when
// watching without filters or once the video has ended. Clicking her re-opens
// the dialog (see reopenGate).
function showBot(gate, { morph = false, say = null } = {}) {
  gate.bot = true;
  noticeBot(gate.anchor, {
    active: gate.filtered && (gate.live || !!gate.result?.video) && !gate.ended,
    onOpen: () => reopenGate(gate),
    morph,
    say,
  });
  notice.gateKey = gate.key;
}

// Bot clicked: pause, blur and ask again, so the viewer can change filters or
// switch mode mid-video. The next choice resumes playback.
function reopenGate(gate) {
  gate.previous = { filtered: gate.filtered, live: !!gate.live }; // what ✕ restores
  gate.state = "deciding";
  gate.bot = false;
  if (gate.youtube) setYouTubeHold(true);
  for (const video of gate.videos()) {
    if (!video) continue;
    video.pause();
    if (!gate.youtube) setGateBlur(video, true);
  }
  showGate(gate);
}

// The decided gate whose bot belongs on screen now: on YouTube the current
// video page's; elsewhere one whose video is still in the page.
function botGate() {
  const youtubeId = pageYouTubeId();
  for (const gate of gates.values()) {
    if (gate.state !== "open" || !gate.bot) continue;
    if (gate.youtube ? gate.key === `youtube:${youtubeId}` : gate.videos().some((v) => v?.isConnected)) return gate;
  }
  return null;
}

// Watching without filters: unscene.it stays completely out of the way
// (prescan.js / debug.js check this too).
function isUnfiltered(video) {
  const gate = gateForVideo(video);
  return gate?.state === "open" && gate.filtered === false;
}

function restartWithPick(gate) {
  library.delete(gate.key);
  gates.delete(gate.key);
  startGate(gate, { pickedByViewer: true });
}

// -- Subjects

function youtubeSubject(youtubeId) {
  return {
    key: `youtube:${youtubeId}`,
    youtube: true,
    // The player box; while YouTube is still building it, its placeholder
    // (the loading skeleton paints the thumbnail in #player-placeholder).
    anchor: () =>
      youtubePlayer() ?? document.querySelector("ytd-player, #player-container-outer, #player-placeholder, #player-wrap"),
    videos: () => {
      const video = youtubePlayer()?.querySelector("video");
      return video ? [video] : [];
    },
    identity: { youtubeId, title: "" },
  };
}

function videoSubject(video) {
  return {
    key: videoKey(video),
    youtube: false,
    anchor: () => video,
    videos: () => [video],
    identity: lookupIdentity(),
  };
}

// Other sites: main videos only (not previews or ads).
function isGatedVideo(video) {
  return !ON_YOUTUBE && !video.dataset.unsceneitShadow && video.offsetWidth >= 200 && video.offsetHeight >= 100;
}

// -- Wiring

// YouTube: one gate per video page, started as soon as the id is in the URL
// (also after in-app navigation), before the player has even loaded.
// While navigating, YouTube's URL can briefly lose the video id; only a page
// that stays without one for this long counts as "left".
const YOUTUBE_LEAVE_GRACE_MS = 500;
let youtubeIdMissingSince = null;

function syncYouTubeGate() {
  const youtubeId = pageYouTubeId();
  const key = youtubeId ? `youtube:${youtubeId}` : null;
  if (key) youtubeIdMissingSince = null;
  else {
    youtubeIdMissingSince ??= Date.now();
    if (Date.now() - youtubeIdMissingSince < YOUTUBE_LEAVE_GRACE_MS) return; // maybe just a URL blip
  }
  // Left that video (another video, or no video page for a while): drop its
  // cover, and cancel a live AI pre-screen that was still running for it.
  for (const gate of gates.values()) {
    if (gate.youtube && gate.key !== key && (UNDECIDED.has(gate.state) || gate.state === "screening")) {
      if (gate.state === "screening") prescan.warmup = null;
      gates.delete(gate.key);
      if (notice.gateKey === gate.key) noticeHide();
    }
  }
  // The overlay (bot or dialog) of a video we left goes with it.
  if (notice.gateKey && notice.gateKey !== key && gates.get(notice.gateKey)?.youtube) noticeHide();
  if (!key) return setYouTubeHold(false);
  if (!gates.has(key)) startGate(youtubeSubject(youtubeId));
}

// Every 100 ms: follow YouTube navigation and keep undecided gates held.
function tick() {
  if (!extensionAlive()) return shutDown();
  if (ON_YOUTUBE) syncYouTubeGate();
  let waiting = false;
  for (const gate of gates.values()) {
    if (UNDECIDED.has(gate.state)) holdGate(gate);
    if (gate.state === "screening") holdScreening(gate);
    waiting ||= UNDECIDED.has(gate.state) || gate.state === "screening";
  }
  // Nothing waiting: keep the bot up (the page may have re-rendered).
  if (!waiting) {
    const gate = botGate();
    if (gate && (notice.gateKey !== gate.key || notice.mode !== "bot" || !notice.host?.isConnected)) showBot(gate);
  }
}

// Live AI pre-screening: keep the video paused and the loader up.
function holdScreening(gate) {
  if (gate.youtube) setYouTubeHold(true);
  for (const video of gate.videos()) if (video && !video.paused) video.pause();
  if (notice.gateKey !== gate.key || !notice.host?.isConnected) {
    gate.progress = noticeScreening(gate.anchor);
    notice.gateKey = gate.key;
  }
}
if (ON_YOUTUBE) syncYouTubeGate(); // right at document_start
const tickTimer = setInterval(tick, 100);

// Cut off from the extension (see extensionAlive): release the page and stop.
function shutDown() {
  clearInterval(tickTimer);
  setYouTubeHold(false);
  holdStyle.remove();
  for (const gate of gates.values()) {
    for (const video of gate.videos()) if (video) setGateBlur(video, false);
  }
  gates.clear();
  noticeHide();
  setDebugMode("off"); // debug.js: stops its ticker and pre-scan, removes its overlay
  clearInterval(prescan.timer);
  standDown(); // prescan.js: shows any hidden scene again
}

// Other sites: gate a <video> as soon as it starts loading (before play).
for (const type of ["loadstart", "loadedmetadata"]) {
  document.addEventListener(
    type,
    (e) => {
      const video = e.target;
      if (video instanceof HTMLVideoElement && isGatedVideo(video)) startGate(videoSubject(video));
    },
    true
  );
}

// The video ended: Xenia rests until it plays again (replay, or seeking back).
document.addEventListener(
  "ended",
  (e) => {
    const video = e.target;
    if (!(video instanceof HTMLVideoElement)) return;
    const gate = gateForVideo(video);
    if (gate?.state !== "open" || !gate.bot || gate.ended) return;
    gate.ended = true;
    if (notice.gateKey === gate.key && notice.mode === "bot") showBot(gate);
  },
  true
);
document.addEventListener(
  "play",
  (e) => {
    const video = e.target;
    if (!(video instanceof HTMLVideoElement)) return;
    const gate = gateForVideo(video);
    if (!gate?.ended) return;
    gate.ended = false;
    if (gate.state === "open" && gate.bot && notice.gateKey === gate.key && notice.mode === "bot") showBot(gate);
  },
  true
);

// Any play while undecided is undone at once (YouTube autoplay, keyboard…).
document.addEventListener(
  "play",
  (e) => {
    const video = e.target;
    if (!(video instanceof HTMLVideoElement)) return;
    if (!ON_YOUTUBE && isGatedVideo(video)) startGate(videoSubject(video));
    if (isHeld(video)) video.pause();
  },
  true
);

// The viewer picked (or cleared) a video in the popup: re-check. Gates still
// waiting for a choice take the pick as "watch with filters".
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "library-changed") return;
  library.clear();
  for (const gate of [...gates.values()]) {
    if (gate.state === "deciding") restartWithPick(gate);
  }
});

