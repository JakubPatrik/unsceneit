// Hiding flagged scenes, and the live AI look-ahead (pre-scan).
//
// Hiding: whenever the viewer watches with filters, flagged scenes (library
// ranges, plus live AI's) play blurred or covered, muted, with a "Hidden: …"
// label. Nothing is ever skipped.
//
// Look-ahead (live AI only): continuous lookahead (PRESCAN_WINDOW_S). Results
// are saved to the library (all built-in filters), blurring only the
// viewer's active ones.
//
// While the viewer watches second k, the frame at second k+5 is captured from
// a hidden shadow <video> (mse-tee.js for MSE players such as YouTube, a
// plain clone for file URLs), analysed by classify-frames, and remembered.
// Playback pauses only once up front, behind a loading animation, to analyse
// the first PRESCAN_WINDOW_S seconds, and again only if analysis falls behind. Flagged
// scenes play under a heavy blur instead of being skipped, so the lookahead
// never has to jump.
//
// Driven by debug.js (prescanSetEnabled / prescanMountLayer /
// prescanUnmountLayer / prescanStatusHtml). Uses enabledFilters / libraryFor
// (content.js), debug* helpers (debug.js) and the lookahead helpers in
// logic.js.

// How far ahead live AI screens, in seconds: analysed before playback starts
// (and after a seek), then kept analysed ahead while playing. The one place
// to change it; the loader texts and timeouts follow.
const PRESCAN_WINDOW_S = 10;
const PRESCAN_LOOKAHEAD_S = PRESCAN_WINDOW_S + 1; // steady state keeps ~PRESCAN_WINDOW_S analysed ahead
const PRESCAN_MAX_IN_FLIGHT = 3;
const PRESCAN_TICK_MS = 250;
const PRESCAN_BLUR_PAD_S = 0.5; // live ranges, each side; library ranges come padded by the backend (skip_padding_s, same value)
const PRESCAN_SEEK_TIMEOUT_MS = 3000;
const PRESCAN_RETRY_MS = 1000;

const prescan = {
  enabled: false, // live AI look-ahead on (hiding runs either way)
  // Live AI just turned on from the dialog: the video is held paused (by
  // content.js, under the unscene.it loader) while the first PRESCAN_WINDOW_S seconds are
  // analysed; onProgress(text, fraction) feeds the loader and onReady(problem)
  // releases + plays it. { onReady, onProgress, started }
  warmup: null,
  timer: null,
  generation: 0, // bumped on reset so stale async results are dropped
  video: null, // the visible video being protected
  mediaKey: null, // which video is playing (logic.js mediaKey); state resets when it changes
  filtersKey: "", // enabled presets; state resets when they change
  shadow: null, // hidden <video> seeked to capture future frames
  ownShadow: false, // true for a plain-URL clone we created
  triedCors: false, // retried the clone with crossorigin="anonymous"
  cloneFailed: false, // source can't be cloned (MediaSource blob without a tee)
  analysed: new Set(), // whole seconds with results
  pending: new Set(), // whole seconds captured or in flight
  liveRanges: [], // { start, end, filter } flagged by the AI
  capturing: false, // shadow busy (one seek sequence at a time)
  retryAt: 0,
  stalling: null, // null | "initial" | "behind"
  blur: null, // { keys, prevValue, prevPriority, mutedByUs } while a flagged scene is hidden
  blurLoop: null, // token of the current per-frame loop; a newer one replaces it
  layer: null, // loader + blur label elements in the overlay's shadow DOM
  libraryApplied: null, // library result whose scanned seconds are in `analysed`
  // Filter ids every analysed second was answered for. Live AI asks about all
  // built-in filters whatever the viewer has on, so switching between them
  // (e.g. turning on Under 12) needs no new analysis.
  analysedFilters: null,
  unavailable: "",
  stallTitle: "", // what the bot says during a stall
  aiRequests: 0, // analysis requests in flight: the bot shows its thinking face
};

// ---- Lifecycle (called by debug.js) ----

// Turns the live AI look-ahead on or off. Hiding by the library's ranges
// goes on either way (prescanTick).
function prescanSetEnabled(on) {
  if (on === prescan.enabled) return;
  prescan.enabled = on;
  if (on) return prescanTick();
  finishWarmup("live AI was switched off");
  if (prescan.stalling) endStall();
  if (prescan.ownShadow) prescan.shadow?.remove();
  // Drop live results now; the next tick starts over from the library's.
  Object.assign(prescan, { mediaKey: null, shadow: null, ownShadow: false, liveRanges: [] });
  prescan.generation++;
  if (prescan.video) applyBlur(prescan.video.currentTime);
}

// Live AI from the "not in the library" panel: hold the (paused) video behind
// the loader while the first seconds are analysed; checkStall() then plays it.
// Live AI from the dialog: content.js keeps the video paused under its loader
// until onReady(problem): the first PRESCAN_WINDOW_S seconds have results (problem = null),
// or live AI can't run here (problem = why). Then it plays.
// Slow answers don't turn live AI off: after this long, playback starts and
// the pre-scan's own stall ("Waiting for analysis…") holds it wherever
// results are still missing.
const PRESCAN_WARMUP_TIMEOUT_MS = Math.max(15000, PRESCAN_WINDOW_S * 1500);

function prescanStartLive({ onReady, onProgress }) {
  prescan.warmup = { onReady, onProgress, started: Date.now() };
  if (prescan.enabled) prescanTick();
  else prescanSetEnabled(true); // the first tick binds the video
}

function finishWarmup(problem = null) {
  const warmup = prescan.warmup;
  prescan.warmup = null;
  warmup?.onReady(problem);
}

function currentFiltersKey() {
  return [...enabledFilters].sort().join(",");
}

// Forgets everything learned about the previous video (or preset set):
// flagged ranges, analysed seconds, the shadow, and any active blur/mute.
function resetFor(video, reason) {
  if (prescan.video && prescan.video !== video && prescan.stalling) endStall();
  unblur(); // also restores mute; the old video's flags no longer apply
  if (prescan.ownShadow) prescan.shadow?.remove();
  const hadVideo = !!prescan.video;
  Object.assign(prescan, {
    video,
    mediaKey: mediaKey(video.currentSrc, location.href),
    filtersKey: currentFiltersKey(),
    shadow: null,
    ownShadow: false,
    triedCors: false,
    cloneFailed: false,
    analysed: new Set(),
    pending: new Set(),
    liveRanges: [],
    capturing: false,
    retryAt: 0,
    libraryApplied: null,
    analysedFilters: null,
  });
  prescan.generation++;
  startBlurLoop(video);
  // Clear the debug panel's frames from the previous video.
  debug.history = [];
  debug.last = null;
  if (hadVideo) debugLog(`${reason}: lookahead reset`);
  else renderOverlay();
}

// Watching without filters: drop any loader, blur and in-flight work for the
// video. If filters are turned back on, the next tick starts over (resetFor).
function standDown() {
  finishWarmup("you're watching without filters");
  if (prescan.stalling) endStall();
  unblur();
  if (!prescan.video) return;
  if (prescan.ownShadow) prescan.shadow?.remove();
  Object.assign(prescan, { video: null, mediaKey: null, shadow: null, ownShadow: false, capturing: false });
  prescan.generation++; // late results and loader progress are dropped
}

// ---- Main loop ----

function prescanTick() {
  if (!prescan.enabled && !gates.size) return standDown(); // nothing gated in this frame
  const video = debugActiveVideo();
  if (!video || isUndecided(video)) return; // the viewer hasn't chosen yet
  if (isUnfiltered(video)) return standDown(); // watching without filters: hands off
  // Without live AI, hide only in videos the viewer chose to watch with filters.
  if (!prescan.enabled && gateForVideo(video)?.state !== "open") return standDown();
  if (debug.video !== video) {
    debug.video = video;
    mountOverlay();
  }
  positionOverlay(); // debug.js's ticker may be off (live AI started from the panel)
  if (video !== prescan.video || mediaKey(video.currentSrc, location.href) !== prescan.mediaKey) {
    resetFor(video, "New video");
  }
  // A library title without live AI: hide its flagged scenes; nothing to look ahead for.
  if (!prescan.enabled) return applyBlur(video.currentTime);
  if (currentFiltersKey() !== prescan.filtersKey) {
    if ([...enabledFilters].every((id) => prescan.analysedFilters?.has(id))) {
      // Already answered for these filters: keep everything, just hide by them.
      prescan.filtersKey = currentFiltersKey();
      prescan.libraryApplied = null;
      debugLog("Presets changed: already analysed for them, no new AI calls");
    } else {
      resetFor(video, "Presets changed");
    }
  }

  if (!enabledFilters.size) {
    unblur();
    // Nothing to screen for: never leave the viewer stuck behind the loader.
    finishWarmup("no filters are enabled");
    if (prescan.stalling) {
      endStall();
      debugLog("Live AI needs at least one filter: playing without screening");
      video.play().catch(() => {});
    }
    return setUnavailable("No filters enabled: pick some in the unscene.it dialog or popup");
  }
  if (!prescan.shadow && !attachLookaheadShadow(video)) {
    // Can't look ahead (e.g. the page loaded before live AI was on): don't
    // leave the viewer stuck behind the loader.
    finishWarmup("reload the page to use it on this video");
    if (prescan.stalling) {
      endStall();
      debugLog(prescan.unavailable);
    }
    return;
  }
  setUnavailable("");
  useLibraryScans(video);
  applyBlur(video.currentTime);

  const t = video.currentTime;
  const covered = screenedEnough(prescan.analysed, t, 1, video.duration);

  // Just turned on: held while the first PRESCAN_WINDOW_S seconds are analysed; as soon as
  // their results are in, finishWarmup() lets content.js play.
  if (prescan.warmup) {
    if (!video.paused) video.pause();
    requestWindow(t, video.duration);
    if (screenedEnough(prescan.analysed, t, PRESCAN_WINDOW_S, video.duration)) finishWarmup();
    else if (Date.now() - prescan.warmup.started > PRESCAN_WARMUP_TIMEOUT_MS) {
      debugLog("Pre-screen is slow: playing, and pausing wherever results are still missing");
      finishWarmup();
    }
    return;
  }

  // Start a stall if playback is about to reach unanalysed frames.
  if (!prescan.stalling && !video.paused && !video.ended && !covered) {
    const nearPending = initialWindow(t, PRESCAN_WINDOW_S, video.duration).some((s) =>
      prescan.pending.has(s)
    );
    startStall(nearPending ? "behind" : "initial");
  }

  if (prescan.stalling) {
    requestWindow(t, video.duration);
    return checkStall();
  }

  // Steady state: keep ~PRESCAN_WINDOW_S analysed ahead, one second at a time (also while
  // paused, so pressing play needs no stall).
  if (document.visibilityState !== "visible" || video.ended) return;
  if (prescan.capturing || prescan.pending.size >= PRESCAN_MAX_IN_FLIGHT) return;
  if (Date.now() < prescan.retryAt) return;
  const s = nextSampleSecond(prescan.analysed, prescan.pending, t, PRESCAN_LOOKAHEAD_S, video.duration);
  if (s !== null) analyseSeconds([s]);
}

// Seconds the library already scanned for every enabled filter count as
// analysed: no AI call for them, and their flagged scenes come from the
// library's ranges (applyBlur). Filters turned on later reset this (resetFor).
function useLibraryScans(video) {
  const lib = libraryFor(video);
  if (!lib || lib === prescan.libraryApplied) return;
  prescan.libraryApplied = lib;
  const known = scannedSeconds(lib.scanned ?? [], enabledFilters);
  for (const s of known) prescan.analysed.add(s);
  if (known.size) debugLog(`${known.size}s already scanned in the library: no AI needed there`);
}

// During a stall: make sure the next PRESCAN_WINDOW_S seconds are captured and in flight.
function requestWindow(t, duration) {
  if (prescan.capturing || Date.now() < prescan.retryAt) return;
  const missing = initialWindow(t, PRESCAN_WINDOW_S, duration).filter(
    (s) => !prescan.analysed.has(s) && !prescan.pending.has(s)
  );
  if (missing.length) analyseSeconds(missing);
}

// ---- Stalls ----

function startStall(kind) {
  prescan.stalling = kind;
  prescan.video.pause();
  showLoader(kind === "initial" ? `Pre-screening the next ${PRESCAN_WINDOW_S} seconds…` : "Waiting for analysis…");
}

function checkStall() {
  const video = prescan.video;
  if (screenedEnough(prescan.analysed, video.currentTime, 2, video.duration)) {
    endStall();
    video.play().catch((err) => debugLog(`Couldn't resume playback: ${err.message}`));
  } else if (!video.paused) {
    video.pause(); // the page (or the viewer) pressed play mid-stall
  }
}

function endStall() {
  prescan.stalling = null;
  hideLoader();
}

// ---- Shadow video ----

// Uses mse-tee.js's shadow when the player is MSE-backed, otherwise clones
// the source (plain URLs, and blob: URLs of ordinary Blobs). A MediaSource
// blob URL can't be cloned, so if the clone fails to load and there's no
// tee shadow, the page was loaded before Pre-scan was on.
function attachLookaheadShadow(video) {
  const src = video.currentSrc;
  if (!src) return false;
  const teed = document.querySelector(`video[data-unsceneit-shadow-for="${CSS.escape(src)}"]`);
  if (teed) {
    prescan.shadow = teed;
    return true;
  }
  if (prescan.cloneFailed) {
    setUnavailable(
      "Lookahead unavailable: reload the page with Pre-scan on (or this player isn't supported)"
    );
    return false;
  }
  const clone = createClone(video, video.crossOrigin);
  const gen = prescan.generation;
  clone.addEventListener("error", () => {
    clone.remove();
    if (gen !== prescan.generation || prescan.shadow !== clone) return;
    Object.assign(prescan, { shadow: null, ownShadow: false, cloneFailed: true });
  });
  prescan.shadow = clone;
  prescan.ownShadow = true;
  return true;
}

function createClone(video, crossOrigin) {
  const clone = document.createElement("video");
  clone.muted = true;
  clone.preload = "auto";
  if (crossOrigin != null) clone.crossOrigin = crossOrigin;
  clone.dataset.unsceneitShadow = "1";
  clone.setAttribute("aria-hidden", "true");
  clone.style.cssText =
    "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;";
  clone.src = video.currentSrc;
  (document.body ?? document.documentElement).appendChild(clone);
  return clone;
}

// Seeks the shadow to `t` and resolves once that frame can be drawn.
function seekShadow(shadow, t) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      shadow.removeEventListener("seeked", onSeeked);
      shadow.removeEventListener("loadeddata", onSeeked);
    };
    const onSeeked = () => {
      if (shadow.seeking || shadow.readyState < 2) return; // wait for data
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Lookahead frame ${formatTime(t)} not buffered yet`));
    }, PRESCAN_SEEK_TIMEOUT_MS);
    shadow.addEventListener("seeked", onSeeked);
    shadow.addEventListener("loadeddata", onSeeked);
    shadow.currentTime = t;
  });
}

// ---- Capture & analysis ----

async function analyseSeconds(seconds) {
  if (!seconds.length) return;
  const gen = prescan.generation;
  const shadow = prescan.shadow;
  seconds.forEach((s) => prescan.pending.add(s));
  const release = () => seconds.forEach((s) => prescan.pending.delete(s));

  // 1. Capture each second from the shadow, one seek at a time.
  const frames = [];
  prescan.capturing = true;
  try {
    for (const [i, s] of seconds.entries()) {
      setLoaderStep(`Capturing frames ${i + 1}/${seconds.length}`, i / (seconds.length + 1));
      await seekShadow(shadow, s);
      if (gen !== prescan.generation) return;
      frames.push({ t: s, image: debugCapture(shadow) });
    }
  } catch (err) {
    if (gen !== prescan.generation) return;
    release();
    prescan.retryAt = Date.now() + PRESCAN_RETRY_MS;
    if (err.name === "SecurityError") return handleCrossOrigin();
    debugLog(`Pre-scan: ${err.message}`);
    return;
  } finally {
    if (gen === prescan.generation) prescan.capturing = false;
  }

  // 2. Analyse them in one request.
  setLoaderStep("Analysing with AI…", seconds.length / (seconds.length + 1));
  noticeBotThinking(++prescan.aiRequests > 0);
  let limit = null; // { quota } when the free live AI minutes ran out
  try {
    const res = await chrome.runtime.sendMessage({
      type: "analyze-frames",
      frames,
      // Live AI saves every built-in filter's ranges to the library; only the
      // viewer's active filters are blurred here (applyBlur).
      persist: true,
      video: { title: cleanTitle(document.title), youtubeId: youtubeIdFromUrl(location.href) },
    });
    if (gen !== prescan.generation) return;
    if (res?.code === "live_ai_limit") limit = res;
    if (!res?.ok) throw new Error(res?.error ?? "No response from background worker");
    const answered = new Set(res.filters.map((f) => f.id));
    prescan.analysedFilters = prescan.analysedFilters
      ? new Set([...prescan.analysedFilters].filter((id) => answered.has(id)))
      : answered;
    prescan.liveRanges.push(
      ...res.ranges.map((r) => ({ start: r.start_s, end: r.end_s, filter: r.filter_id, key: r.filter_key }))
    );
    for (const decision of res.decisions) {
      prescan.analysed.add(decision.t);
      const frame = frames.find((f) => f.t === decision.t);
      debugRecord({
        t: decision.t,
        image: frame.image,
        decision,
        labels: filterLabels(res.filters),
        ms: res.ms,
        mock: res.mock,
      });
    }
  } catch (err) {
    if (gen !== prescan.generation) return;
    prescan.retryAt = Date.now() + PRESCAN_RETRY_MS;
    debugLog(`Pre-scan error: ${err.message}`);
  } finally {
    noticeBotThinking(--prescan.aiRequests > 0); // counted whatever the generation
    if (gen === prescan.generation) {
      release();
      renderOverlay();
    }
  }
  // Free minutes used up: content.js stops live AI and asks the viewer again.
  if (limit && gen === prescan.generation) liveAILimitReached(prescan.video, limit.quota);
}

// A cross-origin clone can't be drawn to a canvas. Retry once with CORS
// (works if the server sends CORS headers), otherwise give up on this video.
function handleCrossOrigin() {
  const video = prescan.video;
  if (prescan.ownShadow && !prescan.triedCors && video.crossOrigin == null) {
    prescan.shadow.remove();
    prescan.shadow = createClone(video, "anonymous");
    prescan.triedCors = true;
    return;
  }
  finishWarmup("this video can't be captured");
  if (prescan.stalling) {
    endStall();
    video.play().catch(() => {});
  }
  prescan.retryAt = Infinity;
  setUnavailable("Lookahead unavailable: cross-origin video can't be captured");
}

// ---- Blur ----

function startBlurLoop(video) {
  if (!("requestVideoFrameCallback" in video)) return;
  const loop = (prescan.blurLoop = {});
  const onFrame = (_now, meta) => {
    if (prescan.blurLoop !== loop || prescan.video !== video) return;
    applyBlur(meta.mediaTime);
    video.requestVideoFrameCallback(onFrame);
  };
  video.requestVideoFrameCallback(onFrame);
}

// A new media resource on the same element (e.g. YouTube's next video):
// force a reset on the next tick even if the URL hasn't changed yet.
for (const type of ["emptied", "loadstart"]) {
  document.addEventListener(
    type,
    (e) => {
      if (prescan.video && e.target === prescan.video) prescan.mediaKey = null;
    },
    true
  );
}

// The video ended: nothing left to wait for.
document.addEventListener(
  "ended",
  (e) => {
    if (e.target === prescan.video && prescan.stalling) endStall();
  },
  true
);

// Seeks and pauses don't produce new frames for the loop above.
for (const type of ["seeked", "timeupdate"]) {
  document.addEventListener(
    type,
    (e) => {
      if (prescan.video && e.target === prescan.video) applyBlur(prescan.video.currentTime);
    },
    true
  );
}

// How flagged scenes are hidden (popup "Flagged scenes" section).
let flaggedHandling = normalizeFlaggedHandling();

chrome.storage.sync.get({ flaggedHandling: null }).then((s) => setFlaggedHandling(s.flaggedHandling));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.flaggedHandling) setFlaggedHandling(changes.flaggedHandling.newValue);
});

function setFlaggedHandling(raw) {
  flaggedHandling = normalizeFlaggedHandling(raw);
  // Re-hide the current scene with the new settings.
  if (prescan.blur && prescan.video) {
    unblur();
    applyBlur(prescan.video.currentTime);
  }
}

function applyBlur(t) {
  const video = prescan.video;
  if (!video) return;
  const dbRanges = libraryFor(video)?.ranges ?? [];
  const keys = [...new Set([
    ...blurKeysAt(prescan.liveRanges, enabledFilters, t, PRESCAN_BLUR_PAD_S, PRESCAN_BLUR_PAD_S),
    ...blurKeysAt(dbRanges, enabledFilters, t, 0),
  ])];
  if (!keys.length) return unblur();

  if (!prescan.blur) {
    const { mute, visual } = flaggedHandling;
    prescan.blur = {
      keys: [],
      prevValue: video.style.getPropertyValue("filter"),
      prevPriority: video.style.getPropertyPriority("filter"),
      mutedByUs: mute && !video.muted, // only undo a mute we caused
    };
    video.style.setProperty("filter", flaggedVideoFilter(visual), "important");
    if (prescan.blur.mutedByUs) video.muted = true;
    showCover(visual === "cover");
    const how = `${visual === "cover" ? "covered" : "blurred"}${mute ? " + muted" : ""}`;
    debugLog(`Hidden at ${formatTime(t)}, ${how} (${keys.join(", ")})`);
  }
  // Players (e.g. YouTube) may restore their own mute state; hold ours.
  if (prescan.blur.mutedByUs && !video.muted) video.muted = true;
  if (keys.join() !== prescan.blur.keys.join()) {
    prescan.blur.keys = keys;
    showBlurLabel(keys);
  }
}

function unblur() {
  if (!prescan.blur) return;
  const video = prescan.video;
  if (video) {
    const { prevValue, prevPriority, mutedByUs } = prescan.blur;
    if (prevValue) video.style.setProperty("filter", prevValue, prevPriority);
    else video.style.removeProperty("filter");
    if (mutedByUs) video.muted = false;
    debugLog(`Shown again at ${formatTime(video.currentTime)}`);
  }
  prescan.blur = null;
  showCover(false);
  showBlurLabel([]);
}

// ---- Loader & blur label (inside debug.js's overlay shadow root) ----

const PRESCAN_CSS = `
  .ps-loader {
    position: absolute; inset: 0; z-index: 1; display: grid; place-items: center;
    background: #050508; opacity: 0; transition: opacity 0.35s ease; overflow: hidden;
  }
  .ps-loader.show { opacity: 1; }
  .ps-frame {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
    filter: blur(14px) brightness(0.35) saturate(1.2); transform: scale(1.08);
  }
  .ps-cover {
    position: absolute; inset: 0; z-index: 1;
    background: radial-gradient(circle at 50% 45%, #4a4a50, #2a2a2e 75%);
  }
  .ps-blur-label {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 1;
    padding: 8px 14px; border-radius: 999px; background: rgba(0, 0, 0, 0.6);
    color: #fff; font: 600 13px/1.3 system-ui, sans-serif; white-space: nowrap;
  }
`;

function prescanMountLayer(root) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <style>${PRESCAN_CSS}</style>
    <div class="ps-cover" hidden></div>
    <div class="ps-loader" hidden>
      <canvas class="ps-frame"></canvas>
    </div>
    <div class="ps-blur-label" hidden></div>`;
  root.append(...wrap.childNodes);
  prescan.layer = {
    loader: root.querySelector(".ps-loader"),
    frame: root.querySelector(".ps-frame"),
    blurLabel: root.querySelector(".ps-blur-label"),
    cover: root.querySelector(".ps-cover"),
  };
  // Re-apply current state (the overlay may remount mid-stall or mid-blur).
  if (prescan.stalling) showLoader(prescan.stallTitle);
  if (prescan.blur) {
    showCover(flaggedHandling.visual === "cover");
    showBlurLabel(prescan.blur.keys);
  }
}

function prescanUnmountLayer() {
  prescan.layer = null;
}

// A stall: the video is covered by a dimmed, blurred copy of its current
// frame, and Xenia (the bot) shows that it's working (busy face, progress in
// its bubble; notice.js).
function showLoader(title) {
  prescan.stallTitle = title;
  noticeBotBusy({ title, step: "Starting…", fraction: 0 });
  const layer = prescan.layer;
  if (!layer) return;
  const video = prescan.video;
  try {
    layer.frame.width = video.videoWidth;
    layer.frame.height = video.videoHeight;
    layer.frame.getContext("2d").drawImage(video, 0, 0);
  } catch {} // cross-origin video: plain dark background
  layer.loader.hidden = false;
  requestAnimationFrame(() => layer.loader.classList.add("show"));
}

function setLoaderStep(text, fraction) {
  prescan.warmup?.onProgress?.(text, fraction); // the screening bot during live AI start
  if (prescan.stalling) noticeBotBusy({ title: prescan.stallTitle, step: text, fraction });
}

function hideLoader() {
  noticeBotBusy(null);
  const layer = prescan.layer;
  if (!layer) return;
  layer.loader.classList.remove("show");
  setTimeout(() => {
    if (!prescan.stalling) layer.loader.hidden = true;
  }, 350);
}

function showCover(on) {
  const cover = prescan.layer?.cover;
  if (cover) cover.hidden = !on;
}

function showBlurLabel(keys) {
  const label = prescan.layer?.blurLabel;
  if (!label) return;
  label.hidden = !keys.length;
  label.textContent = `Hidden: ${keys.join(", ")}`;
}

function setUnavailable(text) {
  if (prescan.unavailable === text) return;
  prescan.unavailable = text;
  renderOverlay();
}

// One-line status for the debug panel.
function prescanStatusHtml() {
  if (prescan.unavailable) return `<div class="status">${esc(prescan.unavailable)}</div>`;
  const video = prescan.video;
  if (!video) return "";
  const covered = coveredUntil(prescan.analysed, video.currentTime);
  const ahead = Math.max(0, covered - video.currentTime);
  const state = prescan.stalling
    ? prescan.stalling === "initial"
      ? "pre-screening"
      : "waiting for analysis"
    : prescan.pending.size
      ? `${prescan.pending.size} in flight`
      : "idle";
  return `<div class="muted">Analysed ahead to ${formatTime(covered)} (+${ahead.toFixed(1)}s) · ${prescan.liveRanges.length} flagged range(s) · ${state}</div>`;
}

// debug.js may have read debugMode (and mounted the overlay) before this
// file loaded.
if (debug.root && !prescan.layer) prescanMountLayer(debug.root);
if (debug.mode === "prescan") prescanSetEnabled(true);
prescan.timer = setInterval(prescanTick, PRESCAN_TICK_MS);
