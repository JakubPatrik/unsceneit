// Preset picker. Builds the UI from the Supabase `content_filters` table and stores
// the enabled filter keys in chrome.storage.sync, which content scripts watch.
//
// Age filters are a single choice: "Under N" enables every age filter with
// min_age >= N (an under-12 viewer also has 15+ and 18+ scenes hidden).
// Trigger filters are independent checkboxes.

const form = document.getElementById("filters");
const status = document.getElementById("status");

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function option(type, name, value, text, checked) {
  return el("label", {}, [el("input", { type, name, value, checked }), text]);
}

async function init() {
  const [{ filters }, { enabledFilters }] = await Promise.all([
    chrome.runtime.sendMessage({ type: "get-filters" }),
    chrome.storage.sync.get({ enabledFilters: [] }),
  ]);
  if (!filters.length) {
    status.textContent = "Couldn't load filters. Is Supabase reachable?";
    return;
  }
  status.remove();

  // Older settings stored filter keys; switch them to ids once.
  const migrated = migrateEnabledFilters(enabledFilters, filters);
  if (migrated.join() !== enabledFilters.join()) chrome.storage.sync.set({ enabledFilters: migrated });
  const enabled = new Set(migrated);
  const age = filters.filter((f) => f.category === "age");
  const triggers = filters.filter((f) => f.category === "trigger");

  const current = selectedAge(age, enabled);

  form.append(
    el("h2", { textContent: "Age" }),
    option("radio", "age", "", "Off", current === null),
    ...age.map((f) =>
      option("radio", "age", f.min_age, `Under ${f.min_age}`, f.min_age === current)
    ),
    el("h2", { textContent: "Triggers" }),
    ...triggers.map((f) =>
      option("checkbox", "trigger", f.id, f.label, enabled.has(f.id))
    )
  );

  form.addEventListener("change", () => {
    const data = new FormData(form);
    const ids = [...ageFilterIds(age, data.get("age")), ...data.getAll("trigger")];
    chrome.storage.sync.set({ enabledFilters: ids });
  });
}

init();

// ---- This video: library match, or pick it manually via search ----
const matchEl = document.getElementById("match");
const searchForm = document.getElementById("video-search");
const resultsEl = document.getElementById("video-results");
let activeTab = null;

async function showMatch() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const state = activeTab
    ? await chrome.runtime.sendMessage({ type: "get-tab-state", tabId: activeTab.id })
    : null;
  matchEl.replaceChildren();
  if (!state) {
    matchEl.textContent = "Play a video on this page to see its library match.";
  } else if (state.match) {
    matchEl.append(
      el("strong", { textContent: state.match.title }),
      ` · ${state.rangeCount} flagged scene(s)${state.manual ? " · picked by you " : ""}`
    );
    if (state.manual) {
      matchEl.append(el("button", { type: "button", textContent: "Undo", onclick: () => selectVideo(null) }));
    }
  } else {
    matchEl.textContent = state.manual
      ? "Your pick is no longer in the library. Search to pick again."
      : "Not in the library. Search below to pick it.";
  }
}

async function selectVideo(video) {
  if (!activeTab) return;
  await chrome.runtime.sendMessage({ type: "select-video", tabId: activeTab.id, pageUrl: activeTab.url, video });
  resultsEl.replaceChildren();
  searchForm.elements.q.value = "";
  matchEl.textContent = video ? `Picked: ${video.title} (applies as the video plays)` : "Cleared your pick.";
}

let searchTimer = null;
searchForm.addEventListener("submit", (e) => e.preventDefault());
searchForm.elements.q.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const query = searchForm.elements.q.value.trim();
    if (query.length < 2) return resultsEl.replaceChildren();
    const videos = await chrome.runtime.sendMessage({ type: "search-videos", query });
    resultsEl.replaceChildren(
      ...(videos.length
        ? videos.map((v) =>
            el("li", {}, [el("button", { type: "button", textContent: v.title, onclick: () => selectVideo(v) })])
          )
        : [el("li", { className: "hint", textContent: "No matches in the library." })])
    );
  }, 250);
});

showMatch();

// Flagged-scene handling (synced like the presets): mute + blur or cover.
// prescan.js in each page watches it.
const flaggedForm = document.getElementById("flagged");
chrome.storage.sync.get({ flaggedHandling: null }).then((s) => {
  const { mute, visual } = normalizeFlaggedHandling(s.flaggedHandling);
  flaggedForm.elements.mute.checked = mute;
  flaggedForm.querySelector(`input[name="visual"][value="${visual}"]`).checked = true;
});
flaggedForm.addEventListener("change", () => {
  const data = new FormData(flaggedForm);
  chrome.storage.sync.set({
    flaggedHandling: { mute: data.has("mute"), visual: data.get("visual") },
  });
});

// Thumbnail blur (synced, on by default). thumbs.js in each page watches it.
const thumbsForm = document.getElementById("thumbnails");
chrome.storage.sync.get({ blurThumbnails: true }).then((s) => {
  thumbsForm.elements.blur.checked = s.blurThumbnails;
});
thumbsForm.addEventListener("change", () =>
  chrome.storage.sync.set({ blurThumbnails: thumbsForm.elements.blur.checked })
);

// Debug section: only in unpacked dev builds ("Load unpacked").
chrome.management.getSelf().then((self) => {
  document.getElementById("debug-section").hidden = self.installType !== "development";
});

// Debug mode (per device, so chrome.storage.local): "off" | "live" | "prescan".
// debug.js, prescan.js and tee-flag.js in each page watch it.
const debugForm = document.getElementById("debug-mode");
chrome.storage.local.get({ debugMode: "off" }).then((s) => {
  const radio = debugForm.querySelector(`input[value="${s.debugMode}"]`);
  if (radio) radio.checked = true;
});
debugForm.addEventListener("change", () =>
  chrome.storage.local.set({ debugMode: new FormData(debugForm).get("debug-mode") })
);
