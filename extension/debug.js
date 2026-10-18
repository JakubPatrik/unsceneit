// Debug overlay (dev only), toggled in the popup via
// chrome.storage.local.debugMode:
//   "live"    — the main playing video in this frame is captured once per
//               second, sent via the background worker to classify-frames as
//               a dry run (nothing is stored), and the result is drawn over
//               the video: the analysed frame, each active filter's verdict
//               and probability, recent frames, hidden scenes and errors.
//   "prescan" — same panel, fed by prescan.js (lookahead + blur); no
//               current-frame capture here.
//
// Uses enabledFilters / libraryFor / mainVideo from content.js, formatTime
// from logic.js, and prescan* hooks from prescan.js.

const DEBUG_TICK_MS = 1000;
const DEBUG_CAPTURE_WIDTH = 512;
const DEBUG_HISTORY = 8;
const DEBUG_LOG_LINES = 6;

const debug = {
  mode: "off", // "off" | "live" | "prescan"
  on: false, // mode !== "off"
  timer: null,
  inFlight: false,
  video: null,
  mediaKey: null, // which video the panel's frames belong to
  host: null,
  root: null,
  panel: null,
  last: null, // { t, image, decision, ms, mock }
  history: [], // same shape, newest first
  log: [], // { time, text, count }, newest first
  status: "",
};
const debugCanvas = document.createElement("canvas");

chrome.storage.local.get({ debugMode: "off" }).then((s) => setDebugMode(s.debugMode));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.debugMode) setDebugMode(changes.debugMode.newValue);
});

// "Show live AI debug panel" toggle in the unscene.it dialog (dev builds; off by
// default). It alone decides whether the "unscene.it debug" panel shows.
let showDebugPanel = false;
chrome.storage.local.get({ showDebugPanel: false }).then((s) => {
  showDebugPanel = s.showDebugPanel;
  renderOverlay();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.showDebugPanel) {
    showDebugPanel = !!changes.showDebugPanel.newValue;
    renderOverlay();
  }
});

function setDebugMode(mode) {
  debug.mode = ["live", "prescan"].includes(mode) ? mode : "off";
  debug.on = debug.mode !== "off";
  if (debug.on && !debug.timer) {
    debug.timer = setInterval(debugTick, DEBUG_TICK_MS);
  }
  if (!debug.on) {
    clearInterval(debug.timer);
    debug.timer = null;
    unmountOverlay();
  }
  // prescan.js loads after this file; it also syncs itself on load in case
  // storage answered before it existed.
  if (typeof prescanSetEnabled === "function") prescanSetEnabled(debug.mode === "prescan");
  if (debug.on) debugTick();
}

// ---- Capture & analysis ----

// The video the panel and the look-ahead work on: the frame's main video
// (content.js mainVideo), so YouTube previews and smaller videos are ignored.
function debugActiveVideo() {
  return mainVideo();
}

// JPEG data URL of the video's current frame. Throws SecurityError for
// cross-origin video without CORS; DRM video captures as a black frame.
function debugCapture(video) {
  const scale = DEBUG_CAPTURE_WIDTH / video.videoWidth;
  debugCanvas.width = DEBUG_CAPTURE_WIDTH;
  debugCanvas.height = Math.round(video.videoHeight * scale);
  debugCanvas.getContext("2d").drawImage(video, 0, 0, debugCanvas.width, debugCanvas.height);
  return debugCanvas.toDataURL("image/jpeg", 0.7);
}

// Filter id → key, for showing decisions (keyed by id) in the panel.
function filterLabels(filters) {
  return Object.fromEntries((filters ?? []).map((f) => [f.id, f.key]));
}

// Adds an analysed frame to the panel (also used by prescan.js).
function debugRecord(entry) {
  debug.last = entry;
  debug.history = [entry, ...debug.history].slice(0, DEBUG_HISTORY);
  renderOverlay();
}

async function debugTick() {
  const video = debugActiveVideo();
  if (!video) return unmountOverlay();
  if (video !== debug.video) {
    debug.video = video;
    mountOverlay();
  }
  positionOverlay();

  // New video (YouTube reuses the element): drop the previous video's frames.
  const key = mediaKey(video.currentSrc, location.href);
  if (key !== debug.mediaKey) {
    debug.mediaKey = key;
    debug.history = [];
    debug.last = null;
  }

  // Pre-scan mode: prescan.js does the analysis; just keep the panel fresh.
  if (debug.mode !== "live") return renderOverlay();
  if (isUndecided(video)) return setStatus("Waiting for the viewer's choice");
  if (isUnfiltered(video)) return setStatus("Watching without filters: not analysing");

  if (debug.inFlight) return;
  if (document.visibilityState !== "visible") return setStatus("Tab hidden: paused");
  if (video.paused || video.ended) return setStatus("Video paused: not analysing");
  if (video.readyState < 2 || !video.videoWidth) return setStatus("Waiting for video data…");
  if (!enabledFilters.size) return setStatus("No presets enabled: pick some in the popup");

  let image;
  try {
    image = debugCapture(video);
  } catch (err) {
    return setStatus(`Can't capture frame (${err.name}): cross-origin video`);
  }

  const t = video.currentTime;
  debug.inFlight = true;
  setStatus("Analysing…");
  try {
    const res = await chrome.runtime.sendMessage({
      type: "analyze-frames",
      frames: [{ t, image }],
      filterIds: [...enabledFilters],
    });
    if (!res?.ok) throw new Error(res?.error ?? "No response from background worker");
    debug.status = "";
    debugRecord({ t, image, decision: res.decisions[0], labels: filterLabels(res.filters), ms: res.ms, mock: res.mock });
  } catch (err) {
    debug.status = "";
    debugLog(`Error: ${err.message}`);
  } finally {
    debug.inFlight = false;
  }
}

function debugLog(text) {
  if (debug.log[0]?.text === text) {
    debug.log[0].count++; // collapse repeats (e.g. the same error every second)
  } else {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    debug.log = [{ time, text, count: 1 }, ...debug.log].slice(0, DEBUG_LOG_LINES);
  }
  renderOverlay();
}

function setStatus(text) {
  debug.status = text;
  renderOverlay();
}

// ---- Overlay UI ----

const DEBUG_CSS = `
  .panel {
    position: absolute; top: 8px; left: 8px; width: 270px; z-index: 2;
    max-height: calc(100% - 16px); overflow: hidden;
    padding: 8px; border-radius: 8px; box-sizing: border-box;
    background: rgba(12, 12, 16, 0.82); color: #eee;
    font: 11px/1.35 system-ui, sans-serif;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }
  .head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-weight: 600; }
  .badge { padding: 1px 5px; border-radius: 4px; font-size: 10px; }
  .badge.mock { background: #6b5b00; color: #ffe680; }
  .badge.live { background: #7a1020; color: #ffb3c0; }
  .ms { margin-left: auto; color: #aaa; font-weight: 400; }
  .frame { display: block; width: 100%; border-radius: 4px; border: 2px solid #444; }
  .frame.bad, .thumbs img.bad { border-color: #ff4d5e; }
  .frame.ok, .thumbs img.ok { border-color: #2fbf71; }
  .meta { color: #aaa; margin: 3px 0 6px; }
  .row { display: grid; grid-template-columns: 70px 1fr 64px; gap: 6px; align-items: center; margin: 2px 0; }
  .key { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: #2fbf71; }
  .row.bad .bar i { background: #ff4d5e; }
  .row.bad .val { color: #ff8090; font-weight: 600; }
  .val { text-align: right; font-variant-numeric: tabular-nums; }
  .thumbs { display: flex; gap: 3px; margin: 6px 0; }
  .thumbs img { width: 29px; height: 17px; object-fit: cover; border-radius: 2px; border: 1.5px solid #444; }
  .muted { color: #999; }
  .status { color: #ffd479; margin-top: 4px; }
  .log { margin-top: 4px; border-top: 1px solid #333; padding-top: 4px; }
  .log div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .log .time { color: #777; margin-right: 4px; }
`;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function mountOverlay() {
  if (!debug.host) {
    debug.host = document.createElement("div");
    debug.host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; pointer-events: none;";
    const root = debug.host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${DEBUG_CSS}</style><div class="panel" hidden></div>`; // hidden until the toggle says otherwise
    debug.root = root;
    debug.panel = root.querySelector(".panel");
    // Loader + blur label, under the panel (prescan.js mounts it itself if it
    // loads after this runs).
    if (typeof prescanMountLayer === "function") prescanMountLayer(root);
    addEventListener("scroll", schedulePosition, { capture: true, passive: true });
    addEventListener("resize", schedulePosition, { passive: true });
    document.addEventListener("fullscreenchange", reparentOverlay);
  }
  reparentOverlay();
  renderOverlay();
}

function unmountOverlay() {
  if (!debug.host) return;
  removeEventListener("scroll", schedulePosition, { capture: true });
  removeEventListener("resize", schedulePosition);
  document.removeEventListener("fullscreenchange", reparentOverlay);
  debug.host.remove();
  debug.host = debug.root = debug.panel = debug.video = null;
  if (typeof prescanUnmountLayer === "function") prescanUnmountLayer();
}

// In fullscreen only the fullscreen element's subtree is visible, so move
// the overlay inside it (unless the <video> itself is fullscreen, which
// can't hold children).
function reparentOverlay() {
  if (!debug.host) return;
  const fs = document.fullscreenElement;
  const parent = fs && fs !== debug.video && fs.contains(debug.video) ? fs : document.documentElement;
  if (debug.host.parentNode !== parent) parent.appendChild(debug.host);
  positionOverlay();
}

let positionQueued = false;
function schedulePosition() {
  if (positionQueued) return;
  positionQueued = true;
  requestAnimationFrame(() => {
    positionQueued = false;
    positionOverlay();
  });
}

function positionOverlay() {
  if (!debug.host || !debug.video) return;
  const r = debug.video.getBoundingClientRect();
  Object.assign(debug.host.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
}

function renderOverlay() {
  if (!debug.panel) return;
  const { last, video } = debug;
  const anyFlagged = (d) => Object.values(d.decision.filters).some(Boolean);

  const head = `
    <div class="head">
      unscene.it debug
      ${last ? `<span class="badge ${last.mock ? "mock" : "live"}">${last.mock ? "MOCK" : "LIVE AI"}</span>` : ""}
      ${last ? `<span class="ms">${last.ms} ms</span>` : ""}
    </div>`;

  // Seconds the library already answered need no AI, so there may be no frame
  // to show at all.
  let body = prescan.enabled && prescan.analysed.size
    ? `<div class="muted">Using library results: no frames sent to the AI yet</div>`
    : `<div class="muted">Waiting for first analysed frame…</div>`;
  if (last) {
    const rows = Object.entries(last.decision.filters)
      .map(([id, flagged]) => {
        const key = last.labels?.[id] ?? id;
        const p = last.decision.probabilities?.[id];
        const pct = p == null ? 100 : Math.round(p * 100);
        const val = p == null ? "refused" : p.toFixed(2);
        return `
          <div class="row ${flagged ? "bad" : "ok"}">
            <span class="key" title="${esc(key)}">${esc(key)}</span>
            <span class="bar"><i style="width:${pct}%"></i></span>
            <span class="val">${flagged ? "✓" : "✗"} ${val}</span>
          </div>`;
      })
      .join("");
    const now = video ? ` · now ${formatTime(video.currentTime)}` : "";
    body = `
      <img class="frame ${anyFlagged(last) ? "bad" : "ok"}" src="${esc(last.image)}">
      <div class="meta">Frame @ ${formatTime(last.t)}${now}</div>
      ${rows}
      <div class="thumbs">
        ${debug.history
          .map(
            (h) =>
              `<img class="${anyFlagged(h) ? "bad" : "ok"}" src="${esc(h.image)}" title="${formatTime(h.t)}">`
          )
          .join("")}
      </div>`;
  }

  const lib = video ? libraryFor(video) : null;
  const activeRanges = lib ? lib.ranges.filter((r) => enabledFilters.has(r.filter)).length : 0;
  const match = !lib ? "looking up…" : lib.video ? `${esc(lib.video.title)} · ${activeRanges} active range(s)` : "none";
  const dbLine = `<div class="muted">Library: ${match}</div>`;
  const status = debug.status ? `<div class="status">${esc(debug.status)}</div>` : "";
  const log = debug.log.length
    ? `<div class="log">${debug.log
        .map(
          (l) =>
            `<div title="${esc(l.text)}"><span class="time">${l.time}</span>${esc(l.text)}${l.count > 1 ? ` (×${l.count})` : ""}</div>`
        )
        .join("")}</div>`
    : "";

  const prescanLine = prescan.enabled ? prescanStatusHtml() : "";

  debug.panel.innerHTML = head + body + dbLine + prescanLine + status + log;
  // Only the panel hides: live AI's loader and "Hidden: …" labels share this
  // overlay and keep working. Shown only with the dialog's toggle on, in dev
  // builds (devBuild, content.js); a store build never shows it.
  // Never while watching without filters: unscene.it stays out of the way.
  const unfiltered = !!video && isUnfiltered(video);
  debug.panel.hidden = !(devBuild && showDebugPanel) || unfiltered;
}
