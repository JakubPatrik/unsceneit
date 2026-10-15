// Unit tests for logic.js. Run with: node --test extension/tests/
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatTime,
  coveredUntil,
  nextSampleSecond,
  initialWindow,
  blurKeysAt,
  normalizeFlaggedHandling,
  migrateEnabledFilters,
  flaggedVideoFilter,
  mediaKey,
  pickVideo,
  youtubeIdFromUrl,
  cleanTitle,
  pageKey,
  mapLibraryResult,
  scannedSeconds,
  ageFilterIds,
  selectedAge,
} = require("../logic.js");

const on = (...ids) => new Set(ids);

describe("labels for logs and the blur badge", () => {
  const ranges = [
    { start: 10, end: 20, filter: "id-gore", key: "gore" },
    { start: 15, end: 30, filter: "id-x" }, // key unknown
  ];

  it("shows filter keys rather than ids", () => {
    assert.deepEqual(blurKeysAt(ranges, on("id-gore"), 12, 1), ["gore"]);
  });

  it("falls back to the id when the key isn't known", () => {
    assert.deepEqual(blurKeysAt(ranges, on("id-x"), 16, 1), ["id-x"]);
  });
});

describe("migrateEnabledFilters", () => {
  const filters = [
    { id: "id-gore", key: "gore" },
    { id: "id-15", key: "rated_15" },
  ];

  it("keeps ids that still exist", () => {
    assert.deepEqual(migrateEnabledFilters(["id-gore", "id-15"], filters), ["id-gore", "id-15"]);
  });

  it("maps legacy keys to ids", () => {
    assert.deepEqual(migrateEnabledFilters(["gore", "rated_15"], filters), ["id-gore", "id-15"]);
  });

  it("drops unknown values and duplicates", () => {
    assert.deepEqual(migrateEnabledFilters(["gore", "id-gore", "spiders", "id-gone"], filters), ["id-gore"]);
  });
});

describe("formatTime", () => {
  it("formats seconds as m:ss.s", () => {
    assert.equal(formatTime(0), "0:00.0");
    assert.equal(formatTime(9.04), "0:09.0");
    assert.equal(formatTime(62.5), "1:02.5");
    assert.equal(formatTime(3600), "60:00.0");
  });

  it("carries into the next minute when rounding up", () => {
    assert.equal(formatTime(59.96), "1:00.0");
  });
});

describe("lookahead", () => {
  const secs = (...s) => new Set(s);

  describe("coveredUntil", () => {
    it("is floor(t) when the current second isn't analysed", () => {
      assert.equal(coveredUntil(secs(11, 12), 10.4), 10);
    });

    it("runs to the first gap after the current second", () => {
      assert.equal(coveredUntil(secs(10, 11, 12, 14), 10.4), 13);
    });
  });

  describe("nextSampleSecond", () => {
    it("starts at the current second when nothing is analysed", () => {
      assert.equal(nextSampleSecond(secs(), secs(), 10.4, 6, 100), 10);
    });

    it("skips analysed and in-flight seconds (frame k+5 while watching k)", () => {
      assert.equal(nextSampleSecond(secs(10, 11, 12, 13), secs(14), 10.4, 6, 100), 15);
    });

    it("returns null once the lookahead window is covered", () => {
      assert.equal(nextSampleSecond(secs(10, 11, 12, 13, 14, 15, 16), secs(), 10.4, 6, 100), null);
    });

    it("fills gaps behind the horizon first", () => {
      assert.equal(nextSampleSecond(secs(10, 12, 13), secs(), 10.4, 6, 100), 11);
    });

    it("stops at the end of the video", () => {
      assert.equal(nextSampleSecond(secs(97, 98, 99), secs(), 97.5, 6, 100), null);
      assert.equal(nextSampleSecond(secs(), secs(), 99.2, 6, 99.5), 99);
    });

    it("treats live streams as unbounded", () => {
      assert.equal(nextSampleSecond(secs(), secs(), 5, 6, Infinity), 5);
    });
  });

  describe("initialWindow", () => {
    it("covers the next windowS whole seconds", () => {
      assert.deepEqual(initialWindow(10.7, 5, 100), [10, 11, 12, 13, 14]);
    });

    it("is cut off at the end of the video", () => {
      assert.deepEqual(initialWindow(97.2, 5, 99.5), [97, 98, 99]);
    });
  });

  describe("blurKeysAt", () => {
    const ranges = [
      { start: 10, end: 20, filter: "gore" },
      { start: 15, end: 30, filter: "rated_15" },
      { start: 50, end: 51, filter: "gore" },
    ];

    it("is empty outside every range", () => {
      assert.deepEqual(blurKeysAt(ranges, on("gore", "rated_15"), 35, 1), []);
    });

    it("starts blurring padBeforeS early", () => {
      assert.deepEqual(blurKeysAt(ranges, on("gore"), 9.2, 1), ["gore"]);
      assert.deepEqual(blurKeysAt(ranges, on("gore"), 8.9, 1), []);
    });

    it("stops at the range end (exclusive)", () => {
      assert.deepEqual(blurKeysAt(ranges, on("gore"), 19.99, 1), ["gore"]);
      assert.deepEqual(blurKeysAt(ranges, on("gore"), 20, 1), []);
    });

    it("keeps blurring padAfterS past the range end", () => {
      assert.deepEqual(blurKeysAt(ranges, on("gore"), 20.5, 1, 1), ["gore"]);
      assert.deepEqual(blurKeysAt(ranges, on("gore"), 21, 1, 1), []);
    });

    it("lists every enabled filter covering t, overlaps included", () => {
      assert.deepEqual(blurKeysAt(ranges, on("gore", "rated_15"), 16, 1), ["gore", "rated_15"]);
    });

    it("ignores disabled filters", () => {
      assert.deepEqual(blurKeysAt(ranges, on("rated_15"), 12, 1), []);
    });
  });
});

describe("flagged-scene handling", () => {
  it("defaults to mute + heavy blur when nothing is stored", () => {
    assert.deepEqual(normalizeFlaggedHandling(undefined), { mute: true, visual: "blur" });
    assert.deepEqual(normalizeFlaggedHandling({}), { mute: true, visual: "blur" });
  });

  it("keeps valid stored values", () => {
    assert.deepEqual(normalizeFlaggedHandling({ mute: false, visual: "cover" }), {
      mute: false,
      visual: "cover",
    });
  });

  it("falls back on invalid values", () => {
    assert.deepEqual(normalizeFlaggedHandling({ mute: "yes", visual: "sparkles" }), {
      mute: true,
      visual: "blur",
    });
  });

  it("uses a stronger, grey filter for full cover", () => {
    assert.match(flaggedVideoFilter("blur"), /blur\(60px\)/);
    assert.match(flaggedVideoFilter("cover"), /grayscale\(1\)/);
  });
});

describe("mediaKey", () => {
  it("changes when the page URL changes, even with the same blob URL (YouTube SPA)", () => {
    const a = mediaKey("blob:https://www.youtube.com/1", "https://www.youtube.com/watch?v=AAA");
    const b = mediaKey("blob:https://www.youtube.com/1", "https://www.youtube.com/watch?v=BBB");
    assert.notEqual(a, b);
  });

  it("changes when the source changes on the same page", () => {
    assert.notEqual(mediaKey("blob:x/1", "https://e.com/p"), mediaKey("blob:x/2", "https://e.com/p"));
  });

  it("ignores the #hash", () => {
    assert.equal(mediaKey("s", "https://e.com/p?a=1#t=30"), mediaKey("s", "https://e.com/p?a=1"));
  });
});

describe("pickVideo", () => {
  const video = (props) => ({
    paused: true,
    ended: false,
    offsetWidth: 100,
    offsetHeight: 100,
    ...props,
  });

  it("returns null when there are no videos", () => {
    assert.equal(pickVideo([]), null);
  });

  it("prefers a playing video over a larger paused one", () => {
    const big = video({ offsetWidth: 1920, offsetHeight: 1080 });
    const playing = video({ paused: false });
    assert.equal(pickVideo([big, playing]), playing);
  });

  it("does not treat an ended video as playing", () => {
    const ended = video({ paused: false, ended: true });
    const big = video({ offsetWidth: 1920, offsetHeight: 1080 });
    assert.equal(pickVideo([ended, big]), big);
  });

  it("falls back to the largest video", () => {
    const small = video({ offsetWidth: 300, offsetHeight: 150 });
    const big = video({ offsetWidth: 1280, offsetHeight: 720 });
    assert.equal(pickVideo([small, big]), big);
  });

  it("does not reorder the input array", () => {
    const small = video({ offsetWidth: 300, offsetHeight: 150 });
    const big = video({ offsetWidth: 1280, offsetHeight: 720 });
    const list = [small, big];
    pickVideo(list);
    assert.deepEqual(list, [small, big]);
  });
});

describe("age presets", () => {
  const age = [
    { id: "rated_12", min_age: 12 },
    { id: "rated_15", min_age: 15 },
    { id: "rated_18", min_age: 18 },
  ];

  describe("ageFilterIds", () => {
    it("Under 12 enables 12+, 15+ and 18+", () => {
      assert.deepEqual(ageFilterIds(age, 12), ["rated_12", "rated_15", "rated_18"]);
    });

    it("Under 15 enables 15+ and 18+", () => {
      assert.deepEqual(ageFilterIds(age, 15), ["rated_15", "rated_18"]);
    });

    it("Under 18 enables only 18+", () => {
      assert.deepEqual(ageFilterIds(age, 18), ["rated_18"]);
    });

    it("accepts the string value a form radio gives", () => {
      assert.deepEqual(ageFilterIds(age, "15"), ["rated_15", "rated_18"]);
    });

    it("Off (empty string or null) enables nothing", () => {
      assert.deepEqual(ageFilterIds(age, ""), []);
      assert.deepEqual(ageFilterIds(age, null), []);
    });
  });

  describe("selectedAge", () => {
    it("is null (Off) when no age filter is enabled", () => {
      assert.equal(selectedAge(age, on("gore")), null);
    });

    it("is the strictest enabled age", () => {
      assert.equal(selectedAge(age, on("rated_12", "rated_15", "rated_18")), 12);
      assert.equal(selectedAge(age, on("rated_15", "rated_18")), 15);
    });

    it("ignores trigger filters", () => {
      assert.equal(selectedAge(age, on("rated_18", "gore", "spiders")), 18);
    });

    it("round-trips with ageFilterIds for every choice", () => {
      for (const n of [12, 15, 18]) {
        assert.equal(selectedAge(age, new Set(ageFilterIds(age, n))), n);
      }
    });
  });

  it("an Under 12 viewer has a 15+ scene hidden", () => {
    const ranges = [{ start: 35, end: 60, filter: "rated_15" }];
    assert.deepEqual(blurKeysAt(ranges, new Set(ageFilterIds(age, 12)), 40, 0), ["rated_15"]);
  });

  it("an Under 18 viewer sees a 15+ scene", () => {
    const ranges = [{ start: 35, end: 60, filter: "rated_15" }];
    assert.deepEqual(blurKeysAt(ranges, new Set(ageFilterIds(age, 18)), 40, 0), []);
  });
});

describe("library lookup helpers", () => {
  describe("youtubeIdFromUrl", () => {
    const id = "aqz-KE-bpKQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}&t=30`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/embed/${id}?autoplay=1`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/live/${id}`,
    ]) {
      it(`finds the id in ${url}`, () => assert.equal(youtubeIdFromUrl(url), id));
    }

    it("ignores other sites and non-video YouTube pages", () => {
      assert.equal(youtubeIdFromUrl(`https://example.com/watch?v=${id}`), null);
      assert.equal(youtubeIdFromUrl("https://www.youtube.com/"), null);
      assert.equal(youtubeIdFromUrl("https://www.youtube.com/watch?v=short"), null);
      assert.equal(youtubeIdFromUrl("not a url"), null);
    });
  });

  describe("cleanTitle", () => {
    it("drops YouTube's notification count and suffix", () => {
      assert.equal(cleanTitle("(3) Sintel - Open Movie - YouTube"), "Sintel - Open Movie");
    });

    it("leaves other titles alone and handles missing ones", () => {
      assert.equal(cleanTitle("  Big Buck Bunny  "), "Big Buck Bunny");
      assert.equal(cleanTitle(undefined), "");
    });
  });

  it("pageKey ignores the #hash", () => {
    assert.equal(pageKey("https://e.com/v?id=1#t=30"), "https://e.com/v?id=1");
  });

  describe("mapLibraryResult", () => {
    it("maps the RPC result to the extension's range shape", () => {
      const video = { id: "v1", title: "Sintel", youtube_id: "eRsGyueVLvQ" };
      assert.deepEqual(
        mapLibraryResult({
          video,
          ranges: [{ start_s: 45, end_s: 60, filter_id: "id-gore", key: "gore" }],
          scanned: [{ start_s: 0, end_s: 90, filter_id: "id-gore" }],
        }),
        {
          video,
          ranges: [{ start: 45, end: 60, filter: "id-gore", key: "gore" }],
          scanned: [{ start: 0, end: 90, filter: "id-gore" }],
        }
      );
    });

    it("treats no match as an empty result", () => {
      assert.deepEqual(mapLibraryResult(null), { video: null, ranges: [], scanned: [] });
    });
  });

  describe("scannedSeconds", () => {
    const scanned = [
      { start: 0, end: 10, filter: "gore" },
      { start: 0, end: 4, filter: "spiders" },
      { start: 6, end: 8.5, filter: "spiders" },
    ];

    it("lists the seconds scanned for one filter", () => {
      assert.deepEqual([...scannedSeconds(scanned, ["gore"])], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("needs every enabled filter scanned (a new filter rescans)", () => {
      assert.deepEqual([...scannedSeconds(scanned, ["gore", "spiders"])], [0, 1, 2, 3, 6, 7]);
      assert.deepEqual([...scannedSeconds(scanned, ["gore", "inappropriate"])], []);
    });

    it("is empty without filters", () => {
      assert.deepEqual([...scannedSeconds(scanned, [])], []);
    });
  });
});
