// Runs at document_start in every frame. thumbs.css blurs video thumbnails
// unless <html data-scenemod-thumbs="off">, which this sets when the viewer
// turned "Blur all video thumbnails" off in the popup (chrome.storage.sync
// blurThumbnails, default on). Follows changes live.

function applyThumbsSetting(blur) {
  if (blur) delete document.documentElement.dataset.scenemodThumbs;
  else document.documentElement.dataset.scenemodThumbs = "off";
}

chrome.storage.sync.get({ blurThumbnails: true }).then((s) => applyThumbsSetting(s.blurThumbnails));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.blurThumbnails) applyThumbsSetting(changes.blurThumbnails.newValue !== false);
});
