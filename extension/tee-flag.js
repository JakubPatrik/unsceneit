// Runs at document_start in the extension's isolated world. Sets
// <html data-unsceneit-tee="1">, which tells mse-tee.js (page main world, no
// chrome.* access) to mirror video buffers for the live AI look-ahead, when:
//   - live AI can run (free minutes left, or a dev build; background.js sets
//     liveAIAvailable), so it's ready by default, or
//   - the pre-scan debug mode is on.
// Once the free minutes are used up nothing is mirrored, and nothing is ever
// mirrored on a site the viewer switched unscene.it off for (site.js).

const teeSettings = { debugMode: "off", liveAIAvailable: false };
let teeSiteOff = false;

function applyTeeFlag() {
  const on = !teeSiteOff && (teeSettings.liveAIAvailable || teeSettings.debugMode === "prescan");
  if (on) document.documentElement.dataset.unsceneitTee = "1";
  else delete document.documentElement.dataset.unsceneitTee;
}

chrome.storage.local.get(teeSettings).then((s) => {
  Object.assign(teeSettings, s);
  applyTeeFlag();
});
chrome.storage.sync.get({ disabledSites: [] }).then((s) => {
  teeSiteOff = isSiteDisabled(s.disabledSites, frameSite());
  applyTeeFlag();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.disabledSites) {
    teeSiteOff = isSiteDisabled(changes.disabledSites.newValue, frameSite());
    return applyTeeFlag();
  }
  if (area !== "local") return;
  for (const key of Object.keys(teeSettings)) {
    if (changes[key]) teeSettings[key] = changes[key].newValue;
  }
  applyTeeFlag();
});
