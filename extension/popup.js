// The toolbar popup: the on/off switch for the current site (site.js), the
// viewer's filters (same picker as the in-page dialog, notice.js
// noticeFilterPicker), the mute-while-hidden switch and the thumbnail blur
// switch. All are in chrome.storage.sync, which the content scripts watch.
//
// Age is a single choice: "Under N" enables every age filter with
// min_age >= N (an under-12 viewer also has 15+ and 18+ scenes hidden).
// Triggers are independent chips.

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// ---- On/off for this site ----
// Off: the page is released at once, in every open tab of the site
// (content.js switchOff). On: the tab reloads, so videos are caught from the
// start again.

const siteSwitch = document.getElementById("site-switch");
const siteLabel = document.getElementById("site-label");

function renderSite(site, on) {
  document.body.classList.toggle("site-off", !on);
  siteSwitch.checked = on;
  siteSwitch.setAttribute("aria-label", `unscene.it on ${site}`);
  siteLabel.replaceChildren(el("span", {}, [on ? "On for " : "Off for ", el("b", { textContent: site })]));
}

async function initSiteSwitch() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const site = siteForUrl(tab?.url);
  if (!site) {
    document.body.classList.add("no-site");
    siteSwitch.disabled = true;
    // The extension only has access to youtube.com (manifest), so any other
    // tab's address is hidden from it too.
    siteLabel.textContent = "unscene.it runs on YouTube. Open a video there.";
    return;
  }
  const { disabledSites } = await chrome.storage.sync.get({ disabledSites: [] });
  renderSite(site, !isSiteDisabled(disabledSites, site));

  siteSwitch.addEventListener("change", async () => {
    const on = siteSwitch.checked;
    const { disabledSites } = await chrome.storage.sync.get({ disabledSites: [] });
    await chrome.storage.sync.set({ disabledSites: withSite(disabledSites, site, on) });
    renderSite(site, on);
    if (on) chrome.tabs.reload(tab.id);
  });
}

initSiteSwitch();

// ---- Filters ----

const filtersForm = document.getElementById("filters");
const filtersBody = document.getElementById("filters-body");

async function initFilters() {
  const [{ filters }, { enabledFilters }] = await Promise.all([
    chrome.runtime.sendMessage({ type: "get-filters" }),
    chrome.storage.sync.get({ enabledFilters: [] }),
  ]);
  if (!filters.length) {
    filtersBody.className = "error";
    filtersBody.textContent = "Couldn't load filters. Check your connection and reopen this menu.";
    return;
  }

  // Older settings stored filter keys; switch them to ids once.
  const migrated = migrateEnabledFilters(enabledFilters, filters);
  if (migrated.join() !== enabledFilters.join()) chrome.storage.sync.set({ enabledFilters: migrated });
  const enabled = new Set(migrated);
  const age = filters.filter((f) => f.category === "age");
  const triggers = filters.filter((f) => f.category === "trigger");
  const currentAge = selectedAge(age, enabled);

  filtersBody.className = "";
  filtersBody.replaceChildren(
    el("select", { name: "age", title: "Age limit" }, [
      el("option", { value: "", textContent: "No age limit", selected: currentAge === null }),
      ...age.map((f) =>
        el("option", { value: f.min_age, textContent: `Under ${f.min_age}`, selected: f.min_age === currentAge })
      ),
    ]),
    el(
      "div",
      { className: "chips" },
      triggers.map((f) =>
        el("label", { className: "chip" }, [
          el("input", { type: "checkbox", name: "trigger", value: f.id, checked: enabled.has(f.id) }),
          el("span", { textContent: f.label }),
        ])
      )
    )
  );

  filtersForm.addEventListener("change", () => {
    const data = new FormData(filtersForm);
    chrome.storage.sync.set({ enabledFilters: [...ageFilterIds(age, data.get("age")), ...data.getAll("trigger")] });
  });
}

filtersForm.addEventListener("submit", (e) => e.preventDefault());
initFilters();

// ---- Mute while a scene is hidden (on by default; prescan.js watches it) ----
// Only the mute is offered here; the visual part of flaggedHandling keeps its
// stored value (heavy blur by default).

const hiddenForm = document.getElementById("hidden-scenes");
let flaggedHandling = normalizeFlaggedHandling();
chrome.storage.sync.get({ flaggedHandling: null }).then((s) => {
  flaggedHandling = normalizeFlaggedHandling(s.flaggedHandling);
  hiddenForm.elements.mute.checked = flaggedHandling.mute;
});
hiddenForm.addEventListener("change", () => {
  flaggedHandling = { ...flaggedHandling, mute: hiddenForm.elements.mute.checked };
  chrome.storage.sync.set({ flaggedHandling });
});

// ---- Thumbnail blur (on by default; thumbs.js in each page watches it) ----

const thumbsForm = document.getElementById("thumbnails");
chrome.storage.sync.get({ blurThumbnails: true }).then((s) => {
  thumbsForm.elements.blur.checked = s.blurThumbnails;
});
thumbsForm.addEventListener("change", () =>
  chrome.storage.sync.set({ blurThumbnails: thumbsForm.elements.blur.checked })
);
