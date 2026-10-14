// Runs at document_start in the extension's isolated world. Sets
// <html data-scenemod-tee="1">, which tells mse-tee.js (page main world, no
// chrome.* access) to mirror video buffers for the live AI look-ahead, when:
//   - live AI is available (dev builds with config.dev.js; background.js sets
//     liveAIAvailable), so it's ready by default, or
//   - the pre-scan debug mode is on.
// Store builds without live AI never mirror anything.

const teeSettings = { debugMode: "off", liveAIAvailable: false };

function applyTeeFlag() {
  const on = teeSettings.liveAIAvailable || teeSettings.debugMode === "prescan";
  if (on) document.documentElement.dataset.scenemodTee = "1";
  else delete document.documentElement.dataset.scenemodTee;
}

chrome.storage.local.get(teeSettings).then((s) => {
  Object.assign(teeSettings, s);
  applyTeeFlag();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const key of Object.keys(teeSettings)) {
    if (changes[key]) teeSettings[key] = changes[key].newValue;
  }
  applyTeeFlag();
});
