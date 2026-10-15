// MSE tee — runs in the page's main world at document_start (pre-scan debug
// mode only).
//
// Streaming players (YouTube and most others) feed <video> through a
// MediaSource whose blob: URL can be attached to only one element, so the
// extension can't simply clone the player to look ahead. This script mirrors
// every video SourceBuffer's appended segments into a second MediaSource
// attached to a hidden "shadow" <video>. prescan.js (isolated world, same
// DOM) finds it via data-unsceneit-shadow-for="<player's blob URL>" and seeks
// it freely to capture upcoming frames without touching the visible player.
//
// Only tees when tee-flag.js set <html data-unsceneit-tee="1">. Every step is
// best-effort: the page's own calls always go through unchanged, and any
// mirroring failure is swallowed.
(() => {
  if (typeof MediaSource === "undefined") return;

  const KEEP_BEHIND_S = 30; // shadow buffer kept behind its seek position

  const enabled = () => document.documentElement?.dataset.unsceneitTee === "1";

  const MSProto = MediaSource.prototype;
  const SBProto = SourceBuffer.prototype;
  const origCreateObjectURL = URL.createObjectURL;
  const origAddSourceBuffer = MSProto.addSourceBuffer;
  const origAppend = SBProto.appendBuffer;
  const origAbort = SBProto.abort;
  const origChangeType = SBProto.changeType;
  const origRemove = SBProto.remove;

  const blobUrls = new WeakMap(); // page MediaSource -> its blob URL
  const shadows = new WeakMap(); // page MediaSource -> shadow
  const tees = new WeakMap(); // page SourceBuffer -> mirrored buffer
  const ownSources = new WeakSet(); // our shadow MediaSources (never teed)

  URL.createObjectURL = function (obj) {
    const url = origCreateObjectURL.call(URL, obj);
    try {
      if (obj instanceof MediaSource && !ownSources.has(obj)) {
        blobUrls.set(obj, url);
        shadows.get(obj)?.tag(url);
      }
    } catch {}
    return url;
  };

  function createShadow(pageSource) {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.dataset.unsceneitShadow = "1";
    video.setAttribute("aria-hidden", "true");
    video.style.cssText =
      "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;";

    const source = new MediaSource();
    ownSources.add(source);
    const shadow = {
      video,
      source,
      open: false,
      buffers: [],
      tag(url) {
        video.dataset.unsceneitShadowFor = url;
      },
    };
    source.addEventListener(
      "sourceopen",
      () => {
        shadow.open = true;
        shadow.buffers.forEach((b) => b.init());
      },
      { once: true }
    );
    video.src = origCreateObjectURL.call(URL, source);
    const url = blobUrls.get(pageSource);
    if (url) shadow.tag(url);
    (document.body ?? document.documentElement).appendChild(video);

    // Player moved on (new video, ad break): drop the shadow.
    pageSource.addEventListener("sourceclose", () => video.remove(), { once: true });
    return shadow;
  }

  // Mirror of one page SourceBuffer: queues operations and applies them to
  // the shadow's buffer whenever it isn't updating.
  function createMirror(shadow, mime) {
    const mirror = {
      buffer: null,
      queue: [],
      dead: false,
      init() {
        try {
          mirror.buffer = origAddSourceBuffer.call(shadow.source, mime);
          mirror.buffer.addEventListener("updateend", pump);
          pump();
        } catch {
          mirror.dead = true;
        }
      },
      enqueue(op) {
        if (mirror.dead) return;
        mirror.queue.push(op);
        pump();
      },
    };

    // Removes buffered media well behind the shadow's position. Returns true
    // if a removal started (it completes asynchronously, then pump resumes).
    function trim(aggressive) {
      const sb = mirror.buffer;
      const buffered = sb.buffered;
      if (!buffered.length) return false;
      const keep = aggressive ? 5 : KEEP_BEHIND_S;
      const cut = shadow.video.currentTime - keep;
      if (buffered.start(0) >= cut) return false;
      origRemove.call(sb, buffered.start(0), cut);
      return true;
    }

    function pump() {
      const sb = mirror.buffer;
      if (!sb || sb.updating || mirror.dead) return;
      try {
        if (trim(false)) return;
      } catch {}
      const op = mirror.queue.shift();
      if (!op) return;
      try {
        if (op.type === "append") {
          if (sb.mode !== op.mode) sb.mode = op.mode;
          if (sb.timestampOffset !== op.offset) sb.timestampOffset = op.offset;
          origAppend.call(sb, op.data); // continues on updateend
        } else if (op.type === "abort") {
          origAbort.call(sb);
          pump();
        } else if (op.type === "changeType") {
          origChangeType.call(sb, op.mime);
          pump();
        }
      } catch (err) {
        if (err?.name === "QuotaExceededError" && op.type === "append") {
          let trimmed = false;
          try {
            trimmed = trim(true);
          } catch {}
          if (trimmed) mirror.queue.unshift(op); // retry after the removal
          else pump(); // nothing to free: drop this segment
        } else {
          pump(); // skip the failed op
        }
      }
    }

    return mirror;
  }

  function copyBytes(data) {
    if (data instanceof ArrayBuffer) return data.slice(0);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  }

  MSProto.addSourceBuffer = function (mime) {
    const buffer = origAddSourceBuffer.call(this, mime);
    try {
      if (enabled() && !ownSources.has(this) && /^video\//i.test(mime)) {
        let shadow = shadows.get(this);
        if (!shadow) {
          shadow = createShadow(this);
          shadows.set(this, shadow);
        }
        const mirror = createMirror(shadow, mime);
        shadow.buffers.push(mirror);
        if (shadow.open) mirror.init();
        tees.set(buffer, mirror);
      }
    } catch {}
    return buffer;
  };

  SBProto.appendBuffer = function (data) {
    const mirror = tees.get(this);
    const offset = this.timestampOffset;
    const mode = this.mode;
    const result = origAppend.call(this, data); // throws → nothing mirrored
    if (mirror) {
      try {
        mirror.enqueue({ type: "append", data: copyBytes(data), offset, mode });
      } catch {}
    }
    return result;
  };

  SBProto.abort = function () {
    const result = origAbort.call(this);
    try {
      tees.get(this)?.enqueue({ type: "abort" });
    } catch {}
    return result;
  };

  if (origChangeType) {
    SBProto.changeType = function (mime) {
      const result = origChangeType.call(this, mime);
      try {
        tees.get(this)?.enqueue({ type: "changeType", mime });
      } catch {}
      return result;
    };
  }
})();
