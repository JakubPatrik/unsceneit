// Per-site on/off switch (popup header). unscene.it is on everywhere except
// the sites in chrome.storage.sync.disabledSites (site keys, see siteKey).
// Turning a site off covers every page on that hostname, e.g. off on
// facebook.com means off on facebook.com/anything.
//
// Loaded first in every frame (manifest) and by the popup. Only function
// declarations here: all content scripts share one scope per frame.

// "www.facebook.com" → "facebook.com". Other subdomains stay distinct
// (m.facebook.com is its own site).
function siteKey(hostname) {
  return String(hostname || "").toLowerCase().replace(/^www\./, "");
}

// The site a frame belongs to: the top-level page's, so a YouTube player
// embedded in facebook.com follows facebook.com's switch.
function frameSite() {
  const origins = typeof location !== "undefined" ? location.ancestorOrigins : null;
  const top = origins && origins.length ? origins[origins.length - 1] : location.origin;
  try {
    return siteKey(new URL(top).hostname);
  } catch {
    return siteKey(location.hostname);
  }
}

// The site key for a tab URL (popup), or null where unscene.it can't run
// (chrome:// pages, the Web Store, new tab…).
function siteForUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? siteKey(u.hostname) : null;
  } catch {
    return null;
  }
}

function isSiteDisabled(disabledSites, site) {
  return Array.isArray(disabledSites) && disabledSites.includes(site);
}

// disabledSites with `site` switched on (removed) or off (added), deduped.
function withSite(disabledSites, site, on) {
  const rest = (Array.isArray(disabledSites) ? disabledSites : []).filter((s) => s !== site);
  return on ? rest : [...rest, site];
}

if (typeof module !== "undefined") {
  module.exports = { siteKey, siteForUrl, isSiteDisabled, withSite };
}
