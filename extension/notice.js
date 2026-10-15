// In-page notices over the video (production UI, all frames):
// `target` is the element to cover, or a function returning it (re-resolved
// continuously, e.g. YouTube's player box).
//   noticeChecking(target)               — loader while the library lookup runs
//   noticeMatched(target, title, count, { pressPlay })
//                                        — success, auto-hides
//   noticeFound(target, { title, ranges, filters, enabled, onFiltersChange, onWithFilters, onWithout, onClose, closeTitle })
//                                        — in the library: watch with or without filters
//   noticeUnmatched(target, { error, liveAI, filters, enabled, onFiltersChange, onPicked, onLiveAI, onWatchAnyway, onClose, closeTitle })
//   Both dialogs include a "Your filters" picker; the choices that need
//   filters stay disabled until at least one is picked.
//                                        — not in the library: pick it via
//                                          search, live AI (Pro; enabled when
//                                          `liveAI`), or watch
//   noticeHide()
// Positioned over the video (or its player while the <video> is still 0×0),
// kept in place continuously, works in fullscreen. While unscene.it is waiting
// (checking / asking), a blurred, darkened cover sits over the whole player:
// it hides the video, its thumbnail and the site's own play button, and
// catches clicks so the player can't be started underneath.

const NOTICE_AUTOHIDE_MS = 3500;

// anchor: () => the element to cover (re-resolved on every reposition, since
// pages like YouTube replace elements while loading). gateKey: set by
// content.js to the gate the notice is showing.
// lastRect: last good position, kept while the anchor briefly vanishes or
// measures 0×0 (YouTube re-lays out its player while loading).
// mode: what's showing — "dialog" (loader or choices, over the cover), "toast",
// "bot" (Xenia, the small round unscene.it bot, in the player's top-right corner),
// "checking" (library lookup: the cover, and the bot saying so), or
// "screening" (live AI's first pre-screen: the cover, and the bot saying how
// far it is).
const notice = {
  host: null, root: null, box: null, cover: null, bot: null, bubble: null,
  anchor: null, gateKey: null, mode: null, timer: null, bubbleTimer: null, tracker: null, lastRect: null,
  busy: null, // live AI working: { title, step, fraction } shown by the bot (noticeBotBusy)
};

const NOTICE_CSS = `
  [hidden] { display: none !important; }
  .cover {
    position: absolute; inset: 0; pointer-events: auto;
    background: rgba(8, 8, 12, 0.6);
    -webkit-backdrop-filter: blur(48px) saturate(0.7); backdrop-filter: blur(48px) saturate(0.7);
  }
  .box {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(360px, calc(100% - 24px)); box-sizing: border-box; padding: 14px 16px;
    border-radius: 12px; background: rgba(14, 14, 20, 0.92); color: #f2f2f7;
    font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    pointer-events: auto;
  }
  .box.toast { top: 16px; transform: translateX(-50%); width: auto; max-width: calc(100% - 24px); padding: 10px 14px; }
  .switch {
    display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px;
    border-top: 1px solid #2c2c3a; font-size: 11.5px; color: #b8b8c8; cursor: pointer; user-select: none;
  }
  .switch input { position: absolute; opacity: 0; pointer-events: none; }
  .switch .track {
    position: relative; flex: none; width: 28px; height: 16px; border-radius: 999px; background: #44445a;
    transition: background-color 0.2s ease;
  }
  .switch .track::after {
    content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%;
    background: #fff; transition: transform 0.2s ease;
  }
  .switch input:checked + .track { background: #6b4cff; }
  .switch input:checked + .track::after { transform: translateX(12px); }
  .switch input:focus-visible + .track { outline: 2px solid #a99cff; outline-offset: 1px; }
  .close {
    position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 50%;
    display: grid; place-items: center; padding: 0; cursor: pointer; pointer-events: auto;
    border: none; background: transparent; color: #b8b8c8; font: 18px/1 system-ui, sans-serif;
  }
  .close:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
  .brand { font-size: 12px; letter-spacing: 0.01em; color: #a99cff; font-weight: 700; }
  .title { font-size: 15px; font-weight: 600; margin: 4px 0; }
  .box:not(.loader):not(.toast) .brand,
  .box:not(.loader):not(.toast) .title { padding-right: 28px; } /* room for the ✕ */
  .muted { color: #b8b8c8; }
  .small { font-size: 11px; margin-top: 12px; }
  .filters { margin: 12px 0 2px; padding: 10px; border-radius: 10px; background: #1b1b26; }
  .filters .label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #a99cff; margin-bottom: 6px; }
  .filters select {
    width: 100%; margin-bottom: 8px; padding: 6px 8px; border-radius: 8px; font: inherit;
    border: 1px solid #44445a; background: #262634; color: #f2f2f7;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; cursor: pointer; }
  .chip input { position: absolute; opacity: 0; pointer-events: none; }
  .chip span {
    padding: 4px 9px; border-radius: 999px; border: 1px solid #44445a; background: #262634;
    font-size: 12px; user-select: none;
  }
  .chip input:checked + span { background: #6b4cff; border-color: #6b4cff; color: #fff; }
  .chip input:focus-visible + span { outline: 2px solid #a99cff; outline-offset: 1px; }
  .hint { font-size: 11px; color: #ffd479; margin: -2px 0 2px; }
  .ok { color: #5fe0a0; font-weight: 600; }
  .box.loader { width: auto; text-align: center; padding: 18px 22px; }
  .progress { width: 220px; height: 4px; margin: 10px auto 0; border-radius: 2px; background: rgba(255, 255, 255, 0.15); overflow: hidden; }
  .progress i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #8b7bff, #4fd1c5); transition: width 0.3s ease; }
  .box.loader .spinner { display: block; width: 30px; height: 30px; margin: 0 auto 10px; border-width: 3px; }
  .spinner {
    display: inline-block; width: 14px; height: 14px; margin-right: 8px; vertical-align: -2px;
    border: 2px solid rgba(255, 255, 255, 0.25); border-top-color: #a99cff; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  input {
    width: 100%; box-sizing: border-box; margin: 10px 0 4px; padding: 7px 9px; border-radius: 8px;
    border: 1px solid #44445a; background: #1d1d28; color: #fff; font: inherit;
  }
  ul { list-style: none; margin: 0; padding: 0; max-height: 132px; overflow-y: auto; }
  li button, .actions button {
    font: inherit; cursor: pointer; border-radius: 8px; border: 1px solid #44445a;
    background: #262634; color: #f2f2f7; padding: 6px 9px;
  }
  li button { width: 100%; text-align: left; margin-top: 4px; }
  li button:hover, .actions button:hover:not(:disabled) { background: #33334a; }
  .actions { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
  .actions button:disabled { opacity: 0.55; cursor: not-allowed; }
  .actions button.primary { background: #6b4cff; border-color: #6b4cff; font-weight: 600; }
  .actions button.primary:hover { background: #7b5fff; }
  .pro { font-size: 10px; font-weight: 700; padding: 1px 5px; margin-left: 4px; border-radius: 4px; background: #6b4cff; color: #fff; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Xenia, the unscene.it bot: a flat round face with two pill eyes in the player's
     top-right corner. Purple while filtering, grey when off. */
  .bot {
    position: absolute; top: 14px; right: 14px; width: 46px; height: 46px; border-radius: 50%;
    display: grid; place-items: center; cursor: pointer; pointer-events: auto;
    background: #5b4cf0; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35);
    transition: background-color 0.35s ease, transform 0.15s ease, box-shadow 0.15s ease;
  }
  .bot:hover { transform: scale(1.08); box-shadow: 0 5px 18px rgba(0, 0, 0, 0.45); }
  /* Keeping the viewer company while the dialog or loader is up: not clickable. */
  .bot.passive { cursor: default; }
  .bot.passive:hover { transform: none; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.35); }
  .bot .eyes { display: flex; gap: 7px; animation: sm-glance 6s ease-in-out infinite; }
  .bot .eye {
    width: 6px; height: 11px; border-radius: 3px; background: #fff;
    animation: sm-blink 4.2s ease-in-out infinite; transform-origin: center;
  }
  .bot .eye + .eye { animation-delay: 0.04s; }
  .bot.idle { background: #8b8b98; }
  .bot.idle .eyes { animation: none; }
  .bot.idle .eye { animation-duration: 6.5s; }
  @keyframes sm-blink {
    0%, 90%, 100% { transform: scaleY(1); }
    94% { transform: scaleY(0.12); }
  }
  @keyframes sm-glance {
    0%, 30% { transform: translateX(0); }
    38%, 52% { transform: translateX(2.5px); }
    60%, 74% { transform: translateX(-2.5px); }
    82%, 100% { transform: translateX(0); }
  }
  /* Thinking (frames are out to the AI right now; noticeBotThinking):
     purple whatever the filter state, a spinning ring around the face, eyes
     glancing up while they hop in turn. */
  .bot.busy, .bot.busy.idle { background: #5b4cf0; }
  .bot.busy::before {
    content: ""; position: absolute; inset: -5px; border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0 45%, #8b7bff 75%, #4fd1c5);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
    animation: sm-spin 1.1s linear infinite;
  }
  .bot.busy .eyes { animation: sm-think 2.4s ease-in-out infinite; }
  .bot.busy .eye { animation: sm-hop 0.8s ease-in-out infinite; }
  .bot.busy .eye + .eye { animation-delay: 0.14s; }
  @keyframes sm-spin { to { transform: rotate(360deg); } }
  @keyframes sm-think {
    0%, 100% { transform: translate(-2px, -2px); }
    50% { transform: translate(2px, -2px); }
  }
  @keyframes sm-hop {
    0%, 60%, 100% { transform: translateY(0) scaleY(1); }
    30% { transform: translateY(-2.5px) scaleY(0.8); }
  }
  .bubble {
    position: absolute; top: 20px; right: 70px; max-width: min(300px, calc(100% - 90px));
    padding: 7px 11px; border-radius: 10px; background: rgba(14, 14, 20, 0.92); color: #f2f2f7;
    font: 12.5px/1.35 system-ui, sans-serif; pointer-events: none;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); transition: opacity 0.25s ease;
  }
  .bubble .step { display: block; color: #b8b8c8; font-size: 11.5px; margin-top: 2px; }
  .bubble .bar { height: 3px; margin-top: 6px; border-radius: 2px; background: rgba(255, 255, 255, 0.15); overflow: hidden; }
  .bubble .bar i {
    display: block; height: 100%; width: 0; border-radius: 2px;
    background: linear-gradient(90deg, #8b7bff, #4fd1c5); transition: width 0.3s ease;
  }
  .ghost { position: absolute; background: rgba(14, 14, 20, 0.92); pointer-events: none; }
`;

function noticeEl(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// target: an element, or a function returning the element to cover.
// cover: show the blurred cover (while waiting); toasts and the bot don't.
// mode: "dialog" | "toast" | "bot" | "checking" | "screening" (see `notice.mode`).
// Modes where the bot does the talking (no box in the middle).
const NOTICE_BOT_MODES = new Set(["bot", "checking", "screening"]);
function noticeMount(target, { cover = false, mode = "dialog" } = {}) {
  if (!notice.host) {
    notice.host = document.createElement("div");
    notice.host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; pointer-events: none;";
    // Top layer (Popover API): drawn above every page element whatever its
    // z-index (YouTube's loading skeleton fades out over z-index max).
    notice.host.popover = "manual";
    // Its own view-transition group, not animated: YouTube swaps its loading
    // skeleton for the app with a View Transition, which otherwise cross-fades
    // snapshots of the whole screen, this overlay included (a visible blink).
    notice.host.style.viewTransitionName = "unsceneit-notice";
    noticeViewTransitionStyle();
    notice.root = notice.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = NOTICE_CSS;
    notice.cover = noticeEl("div", { className: "cover" });
    notice.box = noticeEl("div", { className: "box" });
    // Xenia (the bot) stays in the corner the whole time: over the dialog and
    // loader too, and on its own once a choice is made (see noticeBot).
    notice.bot = noticeEl("div", { className: "bot" }, [
      noticeEl("div", { className: "eyes" }, [noticeEl("div", { className: "eye" }), noticeEl("div", { className: "eye" })]),
    ]);
    notice.bubble = noticeEl("div", { className: "bubble", hidden: true });
    notice.root.append(style, notice.cover, notice.box, notice.bot, notice.bubble);
    notice.bot.classList.toggle("busy", noticeThinking);
    // Keep it over the player as the page lays out (YouTube resizes its
    // player after load); scroll/resize alone would miss that.
    // Follow the covered element on every frame (a timer lags while the page
    // is busy loading).
    const follow = () => {
      if (!notice.host) return;
      noticePosition();
      notice.tracker = requestAnimationFrame(follow);
    };
    notice.tracker = requestAnimationFrame(follow);
    addEventListener("scroll", noticePosition, { capture: true, passive: true });
    addEventListener("resize", noticePosition, { passive: true });
    document.addEventListener("fullscreenchange", noticeOnFullscreen);
  }
  notice.anchor = typeof target === "function" ? target : () => target;
  notice.cover.hidden = !cover;
  notice.mode = mode;
  const prevMode = notice.mode;
  notice.box.hidden = NOTICE_BOT_MODES.has(mode);
  // Whatever the bot was saying belonged to the previous mode.
  if (mode !== prevMode) noticeBotBusy(null);
  // Only the bot on its own opens the dialog (noticeBot sets the handler).
  notice.bot.classList.toggle("passive", mode !== "bot");
  notice.bot.title = mode === "bot" ? "Xenia · change filters" : "Xenia";
  notice.bot.onclick = null;
  if (!NOTICE_BOT_MODES.has(mode)) notice.bubble.hidden = true;
  clearTimeout(notice.timer);
  noticeReparent();
}

// In fullscreen only the fullscreen element's subtree is visible.
function noticeReparent() {
  if (!notice.host) return;
  const el = notice.anchor?.();
  const fs = document.fullscreenElement;
  const parent = fs && el && fs !== el && fs.contains(el) ? fs : document.documentElement;
  if (notice.host.parentNode !== parent) parent.appendChild(notice.host);
  noticeTopLayer();
  noticeGuard(parent);
  noticePosition();
}

// Page-level rules for the overlay's view-transition group (pseudo-elements of
// the document root can't be styled from inside the shadow DOM): show the new
// state at once, at its final place, with no cross-fade.
function noticeViewTransitionStyle() {
  if (document.getElementById("unsceneit-notice-vt")) return;
  const style = document.createElement("style");
  style.id = "unsceneit-notice-vt";
  style.textContent = `
    ::view-transition-group(unsceneit-notice) { animation: none; }
    ::view-transition-old(unsceneit-notice) { display: none; }
    ::view-transition-new(unsceneit-notice) { animation: none; opacity: 1; }`;
  document.documentElement.append(style);
}

// Enter the top layer if not there (e.g. after being re-attached). restack:
// move back on top (after going fullscreen, the fullscreen element joins the
// top layer above us).
function noticeTopLayer(restack = false) {
  const host = notice.host;
  if (!host?.isConnected || typeof host.showPopover !== "function") return;
  try {
    const open = host.matches(":popover-open");
    if (open && !restack) return;
    if (open) host.hidePopover();
    host.showPopover();
  } catch {}
}

function noticeOnFullscreen() {
  noticeReparent();
  noticeTopLayer(true);
}

// Pages like YouTube remove or reshuffle nodes while they boot. Watch the
// overlay's parent and put it back in the same task, before the browser
// paints, so it never blinks. (Only the direct parent's child list is
// observed: cheap even on busy pages.)
let noticeObserver = null;
let noticeObserved = null;
function noticeGuard(parent) {
  if (noticeObserved === parent) return;
  noticeObserver ??= new MutationObserver(() => {
    if (notice.host && !notice.host.isConnected) noticeReparent();
  });
  noticeObserver.disconnect();
  noticeObserver.observe(parent, { childList: true });
  noticeObserved = parent;
}

// Last good position of the covered player, remembered for this tab (session
// storage), so a reload or YouTube's in-app navigation can draw the overlay at
// once, before the new player has laid out.
const NOTICE_RECT_KEY = "unsceneit:lastRect";
function noticeRememberRect(rect) {
  notice.lastRect = rect;
  try {
    sessionStorage.setItem(NOTICE_RECT_KEY, JSON.stringify(rect));
  } catch {}
}
function noticeRememberedRect() {
  try {
    return JSON.parse(sessionStorage.getItem(NOTICE_RECT_KEY));
  } catch {
    return null;
  }
}

// The area to cover: the element itself, or, while it's still tiny (a <video>
// that hasn't laid out yet), the nearest ancestor with a real size.
function noticeTargetRect(target) {
  let el = target;
  for (let depth = 0; el && depth < 8; depth++, el = el.parentElement) {
    const r = el.getBoundingClientRect();
    if (r.width >= 100 && r.height >= 60) return r;
  }
  return target.getBoundingClientRect();
}

function noticePosition() {
  if (!notice.host) return;
  // The page removed us (YouTube's app reshuffles the document while it
  // boots): put the overlay straight back.
  if (!notice.host.isConnected) noticeReparent();
  const el = notice.anchor?.();
  let r = el?.isConnected ? noticeTargetRect(el) : null;
  if (r && (r.width < 100 || r.height < 60)) r = null; // mid-layout
  if (r) {
    const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    const last = notice.lastRect;
    if (!last || last.left !== rect.left || last.top !== rect.top || last.width !== rect.width || last.height !== rect.height) {
      noticeRememberRect(rect);
    }
  } else {
    // Mid-layout or not built yet: keep the last good position (this page's,
    // or this tab's previous page's) instead of hiding.
    r = notice.lastRect ?? (notice.lastRect = noticeRememberedRect());
  }
  // Never laid out yet: don't draw (it would flash at the wrong place).
  notice.host.style.visibility = r ? "visible" : "hidden";
  if (!r) return;
  Object.assign(notice.host.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
}

function noticeHide() {
  clearTimeout(notice.timer);
  cancelAnimationFrame(notice.tracker);
  if (!notice.host) return;
  removeEventListener("scroll", noticePosition, { capture: true });
  removeEventListener("resize", noticePosition);
  document.removeEventListener("fullscreenchange", noticeOnFullscreen);
  noticeObserver?.disconnect();
  noticeObserved = null;
  notice.host.remove();
  clearTimeout(notice.bubbleTimer);
  notice.host = notice.root = notice.box = notice.cover = notice.anchor = notice.tracker = null;
  notice.bot = notice.bubble = notice.mode = notice.busy = null;
  notice.gateKey = notice.lastRect = null;
}

// Library lookup: the cover stays over the player, and the bot says what's
// happening (spinner + message in its bubble).
function noticeChecking(target) {
  noticeMount(target, { cover: true, mode: "checking" });
  noticeBotBusy({ title: "Checking this video against your filters…", spinner: true });
}

// Live AI starting: loader over the blurred, paused player while the first PRESCAN_WINDOW_S
// seconds are pre-screened. Returns update(text, fraction) for its progress.
function noticeScreening(target) {
  // The dialog flies into the bot, which shows the progress; the cover stays.
  const morphFrom = noticeMorphSource();
  noticeMount(target, { cover: true, mode: "screening" });
  noticeBotBusy({ title: `Pre-screening the first ${PRESCAN_WINDOW_S} seconds…`, step: "Starting…", fraction: 0 }); // prescan.js
  if (morphFrom) noticeMorphIntoBot(morphFrom, { keepCover: true });
  return (step, fraction) => noticeBotBusy({ step, fraction });
}

// unscene.it is holding the video: a sticky bubble by the bot with what it's
// waiting for ({ title, step, fraction, spinner }; missing fields keep their
// value; a progress bar shows when there's a fraction).
// null: done, the bubble goes. (The face only changes while frames are
// actually with the AI: noticeBotThinking.) Only shows over
// the bot (playing) or the screening cover, never over a dialog.
function noticeBotBusy(update) {
  if (!notice.bot) return;
  if (!update) {
    if (!notice.busy) return;
    notice.busy = null;
    noticeBubbleFade();
    return;
  }
  if (!NOTICE_BOT_MODES.has(notice.mode)) return;
  const busy = (notice.busy = { ...notice.busy, ...update });
  clearTimeout(notice.bubbleTimer);
  const bar = noticeEl("i");
  bar.style.width = `${Math.round((busy.fraction ?? 0) * 100)}%`;
  notice.bubble.replaceChildren(
    ...(busy.spinner ? [noticeEl("span", { className: "spinner" })] : []),
    noticeEl("strong", { textContent: busy.title ?? "Analysing…" }),
    ...(busy.step ? [noticeEl("span", { className: "step", textContent: busy.step })] : []),
    ...(busy.fraction != null ? [noticeEl("div", { className: "bar" }, [bar])] : [])
  );
  notice.bubble.hidden = false;
  notice.bubble.style.opacity = "1";
}

// A small status note over the top of the video (no cover). spinner: show a
// spinner; sticky: stay until replaced (otherwise it auto-hides).
function noticeToast(target, text, { spinner = false, sticky = false } = {}) {
  noticeMount(target, { mode: "toast" });
  notice.box.className = "box toast";
  notice.box.replaceChildren(
    ...(spinner ? [noticeEl("span", { className: "spinner" })] : []),
    noticeEl("span", { textContent: text })
  );
  if (!sticky) notice.timer = setTimeout(noticeHide, NOTICE_AUTOHIDE_MS);
}

// pressPlay: the browser blocked autoplay, so ask the viewer to press play.
function noticeMatched(target, title, flaggedCount, { pressPlay = false } = {}) {
  noticeMount(target, { mode: "toast" });
  notice.box.className = "box toast";
  const detail =
    flaggedCount > 0
      ? ` · ${flaggedCount} scene${flaggedCount === 1 ? "" : "s"} will be hidden`
      : " · nothing flagged for your filters";
  notice.box.replaceChildren(
    noticeEl("span", { className: "ok", textContent: "✓ Protected: " }),
    noticeEl("strong", { textContent: title }),
    noticeEl("span", { className: "muted", textContent: detail + (pressPlay ? " · press play" : "") })
  );
  notice.timer = setTimeout(noticeHide, NOTICE_AUTOHIDE_MS);
}

// After a choice, the dialog shrinks into Xenia, the bot, in the player's
// top-right corner. active: eyes look around (filters or live AI on); else
// closed (watching without filters). onOpen: the bot was clicked (content.js
// pauses and re-opens the dialog). say: a short speech bubble. morph: animate
// from the dialog that's showing now.
function noticeBot(target, { active, onOpen, say = null, morph = false }) {
  const morphFrom = morph ? noticeMorphSource() : null;
  // The cover fades out when the bot takes over from a dialog or the
  // screening cover (instead of vanishing).
  const fadeCover = !!notice.cover && !notice.cover.hidden && (!!morphFrom || NOTICE_BOT_MODES.has(notice.mode));
  noticeMount(target, { cover: fadeCover, mode: "bot" });

  notice.bot.classList.toggle("idle", !active);
  notice.bot.onclick = (e) => {
    e.stopPropagation();
    onOpen();
  };
  if (say) noticeBotSay(say);

  if (morphFrom) noticeMorphIntoBot(morphFrom);
  else if (fadeCover) noticeFadeCover();
}

// Where the dialog is now, for flying it into the bot (null: no dialog showing).
function noticeMorphSource() {
  return notice.host?.isConnected && notice.mode === "dialog" && notice.box && !notice.box.hidden
    ? { box: notice.box.getBoundingClientRect(), host: notice.host.getBoundingClientRect() }
    : null;
}

function noticeFadeCover() {
  const cover = notice.cover;
  cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease-out" }).finished.then(() => {
    if (notice.mode === "bot") cover.hidden = true;
  });
}

// The dialog's box shrinks and slides into the bot; the cover fades out
// (unless keepCover: live AI's pre-screen keeps the video covered).
function noticeMorphIntoBot({ box, host }, { keepCover = false } = {}) {
  const bot = notice.bot;
  const hostNow = notice.host.getBoundingClientRect();
  const end = bot.getBoundingClientRect();
  const ghost = noticeEl("div", { className: "ghost" });
  notice.root.insertBefore(ghost, bot); // under the bot, which it flies into
  const rect = (r, base) => ({ left: `${r.left - base.left}px`, top: `${r.top - base.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const timing = { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" };
  const flight = ghost.animate(
    [
      { ...rect(box, host), borderRadius: "12px", opacity: 1 },
      { ...rect(end, hostNow), borderRadius: "50%", opacity: 0.9 },
    ],
    timing
  );
  // The bot was already there: it "catches" the dialog with a small bounce.
  bot.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], {
    duration: 260, delay: 340, easing: "ease-out",
  });
  if (!keepCover && !notice.cover.hidden) noticeFadeCover();
  flight.finished.then(() => ghost.remove(), () => ghost.remove());
}

// The bot's thinking face, only while live AI has frames out to the AI
// (prescan.js counts its requests in flight). Kept across overlay remounts.
let noticeThinking = false;
function noticeBotThinking(on) {
  noticeThinking = on;
  notice.bot?.classList.toggle("busy", on);
}

// A short speech bubble next to the bot (auto-hides unless sticky).
function noticeBotSay(text, { sticky = false } = {}) {
  if (!notice.bubble) return;
  clearTimeout(notice.bubbleTimer);
  notice.bubble.textContent = text;
  notice.bubble.hidden = false;
  notice.bubble.style.opacity = "1";
  if (!sticky) notice.bubbleTimer = setTimeout(noticeBubbleFade, 3500);
}

function noticeBubbleFade() {
  clearTimeout(notice.bubbleTimer);
  if (!notice.bubble || notice.bubble.hidden) return;
  notice.bubble.style.opacity = "0";
  notice.bubbleTimer = setTimeout(() => notice.bubble && !notice.busy && (notice.bubble.hidden = true), 260);
}

// "Your filters" inside the dialog: age limit (single choice) + trigger chips,
// the same settings as the popup. Calls onChange(ids) on every change.
function noticeFilterPicker(filters, enabled, onChange) {
  const age = filters.filter((f) => f.category === "age");
  const triggers = filters.filter((f) => f.category === "trigger");
  const currentAge = selectedAge(age, enabled);
  const form = noticeEl("form", { className: "filters" }, [
    noticeEl("div", { className: "label", textContent: "Your filters" }),
    noticeEl("select", { name: "age", title: "Age limit" }, [
      noticeEl("option", { value: "", textContent: "No age limit", selected: currentAge === null }),
      ...age.map((f) =>
        noticeEl("option", { value: f.min_age, textContent: `Under ${f.min_age}`, selected: f.min_age === currentAge })
      ),
    ]),
    noticeEl(
      "div",
      { className: "chips" },
      triggers.map((f) =>
        noticeEl("label", { className: "chip" }, [
          noticeEl("input", { type: "checkbox", name: "trigger", value: f.id, checked: enabled.has(f.id) }),
          noticeEl("span", { textContent: f.label }),
        ])
      )
    ),
  ]);
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("change", () => {
    const data = new FormData(form);
    onChange([...ageFilterIds(age, data.get("age")), ...data.getAll("trigger")]);
  });
  return form;
}

// Optional "Show live AI debug panel" switch at the bottom of the dialogs
// (dev builds only). debugPanel: { on, onChange(on) } or null.
function noticeDebugToggle(debugPanel) {
  if (!debugPanel) return [];
  const input = noticeEl("input", { type: "checkbox", checked: !!debugPanel.on });
  input.addEventListener("change", () => debugPanel.onChange(input.checked));
  return [
    noticeEl("label", { className: "switch" }, [
      input,
      noticeEl("span", { className: "track" }),
      noticeEl("span", { textContent: "Show live AI debug panel" }),
    ]),
  ];
}

// ✕ in the dialog's top-right corner (see onClose in content.js).
function noticeCloseButton(onClose, title) {
  return noticeEl("button", { type: "button", className: "close", textContent: "✕", title, ariaLabel: title, onclick: onClose });
}

// Keep the page's keyboard shortcuts (e.g. YouTube's space/k) out of the box.
function noticeIsolateKeys(el) {
  for (const type of ["keydown", "keyup", "keypress"]) el.addEventListener(type, (e) => e.stopPropagation());
}

// A button that needs at least one filter, plus the hint shown while it can't.
function noticeNeedsFilters(button, hint, enabled) {
  const ok = enabled.size > 0;
  if (!button.dataset.unavailable) button.disabled = !ok;
  hint.hidden = ok;
}

// "Search the library" box: picking a result saves it for this page (it then
// wins over the automatic match) and calls onPicked(video).
function noticeLibrarySearch(label, onPicked) {
  const results = noticeEl("ul");
  const search = noticeEl("input", { type: "search", placeholder: "Search the unscene.it library…" });
  let timer = null;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const query = search.value.trim();
      if (query.length < 2) return results.replaceChildren();
      const videos = await chrome.runtime.sendMessage({ type: "search-videos", query }).catch(() => []);
      results.replaceChildren(
        ...(videos.length
          ? videos.map((v) =>
              noticeEl("li", {}, [
                noticeEl("button", {
                  type: "button",
                  textContent: v.title,
                  onclick: async () => {
                    await chrome.runtime.sendMessage({ type: "pick-video-here", video: v });
                    onPicked(v);
                  },
                }),
              ])
            )
          : [noticeEl("li", { className: "muted", textContent: "No matches in the library." })])
      );
    }, 250);
  });
  return [noticeEl("div", { className: "muted small", textContent: label }), search, results];
}

// In the library: watch with or without filters.
//   ranges: the video's library ranges ({ filter }), to count what gets hidden.
//   filters/enabled/onFiltersChange: the "Your filters" picker.
//   liveRest: "with filters" also runs live AI for what isn't scanned yet.
function noticeFound(
  target,
  {
    title, ranges, filters, enabled, onFiltersChange, onWithFilters, onWithout,
    liveRest = false, onClose, closeTitle, debugPanel = null,
  }
) {
  noticeMount(target, { cover: true });
  notice.box.className = "box";
  let current = new Set(enabled);

  const detail = noticeEl("div", { className: "muted" });
  const withFilters = noticeEl("button", { type: "button", className: "primary", textContent: "Watch with filters", onclick: onWithFilters });
  const hint = noticeEl("div", { className: "hint", textContent: "Pick at least one filter to watch with filters." });
  const refresh = () => {
    const count = ranges.filter((r) => current.has(r.filter)).length;
    detail.textContent =
      "Found in the library. " +
      (current.size === 0
        ? "Pick your filters below."
        : count > 0
          ? `${count} scene${count === 1 ? "" : "s"} will be hidden for your filters.`
          : "Nothing is flagged for your current filters.") +
      (liveRest && current.size > 0 ? " Live AI screens anything not scanned yet." : "");
    noticeNeedsFilters(withFilters, hint, current);
  };
  const picker = noticeFilterPicker(filters, current, (ids) => {
    current = new Set(ids);
    onFiltersChange(ids);
    refresh();
  });
  refresh();

  notice.box.replaceChildren(
    noticeCloseButton(onClose, closeTitle),
    noticeEl("div", { className: "brand", textContent: "unscene.it" }),
    noticeEl("div", { className: "title" }, [noticeEl("span", { className: "ok", textContent: "✓ " }), title]),
    detail,
    picker,
    noticeEl("div", { className: "actions" }, [
      withFilters,
      hint,
      noticeEl("button", { type: "button", textContent: "Watch without filters", onclick: onWithout }),
    ]),
    ...noticeDebugToggle(debugPanel)
  );
  noticeIsolateKeys(notice.box);
}

function noticeUnmatched(
  target,
  {
    error = false, liveAI = false, filters, enabled, onFiltersChange, onPicked, onLiveAI, onWatchAnyway,
    onClose, closeTitle, debugPanel = null,
  }
) {
  noticeMount(target, { cover: true });
  notice.box.className = "box";
  let current = new Set(enabled);

  const liveButton = liveAI
    ? noticeEl("button", { type: "button", className: "primary", onclick: onLiveAI }, [
        "Turn on live AI filter",
        noticeEl("span", { className: "pro", textContent: "PRO" }),
      ])
    : noticeEl("button", { type: "button", disabled: true, title: "Coming soon" }, [
        "Turn on live AI filter",
        noticeEl("span", { className: "pro", textContent: "PRO" }),
        noticeEl("span", { className: "muted", textContent: " · coming soon" }),
      ]);
  if (!liveAI) liveButton.dataset.unavailable = "1";
  const hint = noticeEl("div", { className: "hint", textContent: "Pick at least one filter to use live AI." });
  const picker = noticeFilterPicker(filters, current, (ids) => {
    current = new Set(ids);
    onFiltersChange(ids);
    noticeNeedsFilters(liveButton, hint, current);
  });
  noticeNeedsFilters(liveButton, hint, current);
  if (!liveAI) hint.hidden = true;

  notice.box.replaceChildren(
    noticeCloseButton(onClose, closeTitle),
    noticeEl("div", { className: "brand", textContent: "unscene.it" }),
    noticeEl("div", {
      className: "title",
      textContent: error ? "Couldn't check this video" : "This video isn't in the library yet",
    }),
    noticeEl("div", {
      className: "muted",
      textContent: error
        ? "unscene.it couldn't reach its library. Turn on the live AI filter, or watch without filters."
        : "Turn on the live AI filter to screen it as you watch, or watch without filters.",
    }),
    picker,
    noticeEl("div", { className: "actions" }, [
      liveButton,
      hint,
      noticeEl("button", { type: "button", textContent: "Watch without filters", onclick: onWatchAnyway }),
    ]),
    ...noticeLibrarySearch("Listed under another name? Search the library:", onPicked),
    ...noticeDebugToggle(debugPanel)
  );
  noticeIsolateKeys(notice.box);
}
