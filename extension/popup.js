// The toolbar popup: the viewer's filters (same picker as the in-page dialog,
// notice.js noticeFilterPicker) and the thumbnail blur switch. Both are in
// chrome.storage.sync, which the content scripts watch.
//
// Age is a single choice: "Under N" enables every age filter with
// min_age >= N (an under-12 viewer also has 15+ and 18+ scenes hidden).
// Triggers are independent chips.

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

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

// ---- Thumbnail blur (on by default; thumbs.js in each page watches it) ----

const thumbsForm = document.getElementById("thumbnails");
chrome.storage.sync.get({ blurThumbnails: true }).then((s) => {
  thumbsForm.elements.blur.checked = s.blurThumbnails;
});
thumbsForm.addEventListener("change", () =>
  chrome.storage.sync.set({ blurThumbnails: thumbsForm.elements.blur.checked })
);
