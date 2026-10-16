// Runs at document_start in every frame. thumbs.css blurs video thumbnails
// unless <html data-unsceneit-thumbs="off">, which this sets when the viewer
// turned "Blur video thumbnails" off in the popup (chrome.storage.sync
// blurThumbnails, default on), or switched unscene.it off for this site
// (disabledSites, site.js). Follows changes live.

const thumbs = { blur: true, siteOff: false };

function applyThumbsSetting() {
  if (thumbs.blur && !thumbs.siteOff) delete document.documentElement.dataset.unsceneitThumbs;
  else document.documentElement.dataset.unsceneitThumbs = "off";
}

chrome.storage.sync.get({ blurThumbnails: true, disabledSites: [] }).then((s) => {
  thumbs.blur = s.blurThumbnails !== false;
  thumbs.siteOff = isSiteDisabled(s.disabledSites, frameSite());
  applyThumbsSetting();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.blurThumbnails) thumbs.blur = changes.blurThumbnails.newValue !== false;
  if (changes.disabledSites) thumbs.siteOff = isSiteDisabled(changes.disabledSites.newValue, frameSite());
  applyThumbsSetting();
});
