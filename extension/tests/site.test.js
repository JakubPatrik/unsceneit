// Unit tests for site.js (per-site on/off). Run with: node --test extension/tests/*.test.js
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { siteKey, siteForUrl, isSiteDisabled, withSite } = require("../site.js");

describe("siteKey", () => {
  it("drops www. and lowercases", () => {
    assert.equal(siteKey("WWW.Facebook.com"), "facebook.com");
  });
  it("keeps other subdomains distinct", () => {
    assert.equal(siteKey("m.facebook.com"), "m.facebook.com");
  });
});

describe("siteForUrl", () => {
  it("covers every page on the hostname", () => {
    assert.equal(siteForUrl("https://www.facebook.com/groups/123?x=1"), "facebook.com");
    assert.equal(siteForUrl("https://facebook.com/"), "facebook.com");
  });
  it("is null where the extension can't run", () => {
    assert.equal(siteForUrl("chrome://extensions/"), null);
    assert.equal(siteForUrl("chrome-extension://abc/popup.html"), null);
    assert.equal(siteForUrl(undefined), null);
  });
});

describe("isSiteDisabled / withSite", () => {
  it("is on everywhere by default", () => {
    assert.equal(isSiteDisabled([], "youtube.com"), false);
    assert.equal(isSiteDisabled(undefined, "youtube.com"), false);
  });
  it("turns one site off without touching others", () => {
    const off = withSite([], "facebook.com", false);
    assert.equal(isSiteDisabled(off, "facebook.com"), true);
    assert.equal(isSiteDisabled(off, "youtube.com"), false);
  });
  it("turns it back on, and never duplicates", () => {
    const twice = withSite(withSite([], "facebook.com", false), "facebook.com", false);
    assert.deepEqual(twice, ["facebook.com"]);
    assert.deepEqual(withSite(twice, "facebook.com", true), []);
  });
});
