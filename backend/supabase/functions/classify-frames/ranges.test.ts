// Run with: node --experimental-strip-types --test backend/supabase/functions/classify-frames/ranges.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  answerProbabilities,
  answersByFilterId,
  buildRanges,
  flaggedFilters,
  frameDecisions,
  mockAnswers,
  questionName,
  groupByFilters,
  mergeAnswers,
  minutesFor,
  secondProbs,
  storedAnswers,
  selectFilters,
} from "./ranges.ts";

describe("flaggedFilters", () => {
  it("flags predicates at or above the threshold", () => {
    const answers = [
      { type: "predicate", name: "gore", probability: 0.5 },
      { type: "predicate", name: "spiders", probability: 0.49 },
      { type: "predicate", name: "inappropriate", probability: 0.97 },
    ];
    assert.deepEqual(flaggedFilters(answers, 0.5), ["gore", "inappropriate"]);
  });

  it("treats a refusal as flagged", () => {
    assert.deepEqual(flaggedFilters([{ type: "refusal", name: "rated_18" }], 0.5), ["rated_18"]);
  });

  it("ignores unknown answer types", () => {
    assert.deepEqual(flaggedFilters([{ type: "score", name: "x" }], 0.5), []);
  });
});

describe("buildRanges", () => {
  const f = (t: number, ...flags: string[]) => ({ t, flags });

  it("returns nothing when no frame is flagged", () => {
    assert.deepEqual(buildRanges([f(0), f(1), f(2)], 1), []);
  });

  it("turns one flagged frame into a one-interval range", () => {
    assert.deepEqual(buildRanges([f(0), f(1, "gore"), f(2)], 1), [
      { filter_id: "gore", start_s: 1, end_s: 2 },
    ]);
  });

  it("merges consecutive flagged frames", () => {
    assert.deepEqual(buildRanges([f(9), f(10, "gore"), f(11, "gore"), f(12, "gore"), f(13)], 1), [
      { filter_id: "gore", start_s: 10, end_s: 13 },
    ]);
  });

  it("bridges a single clean frame between two flagged ones (no flicker)", () => {
    assert.deepEqual(buildRanges([f(0, "gore"), f(1), f(2, "gore")], 1), [
      { filter_id: "gore", start_s: 0, end_s: 3 },
    ]);
  });

  it("splits runs separated by two or more clean frames", () => {
    assert.deepEqual(buildRanges([f(0, "gore"), f(1), f(2), f(3, "gore")], 1), [
      { filter_id: "gore", start_s: 0, end_s: 1 },
      { filter_id: "gore", start_s: 3, end_s: 4 },
    ]);
  });

  it("only bridges within the same filter", () => {
    assert.deepEqual(buildRanges([f(0, "gore"), f(1, "spiders"), f(2, "gore")], 1), [
      { filter_id: "gore", start_s: 0, end_s: 3 },
      { filter_id: "spiders", start_s: 1, end_s: 2 },
    ]);
  });

  it("splits runs across a gap in sampling", () => {
    assert.deepEqual(buildRanges([f(0, "gore"), f(5, "gore")], 1), [
      { filter_id: "gore", start_s: 0, end_s: 1 },
      { filter_id: "gore", start_s: 5, end_s: 6 },
    ]);
  });

  it("respects the sampling interval", () => {
    assert.deepEqual(buildRanges([f(0, "gore"), f(2, "gore"), f(4)], 2), [
      { filter_id: "gore", start_s: 0, end_s: 4 },
    ]);
  });

  it("produces overlapping ranges for different filters", () => {
    const frames = [f(29), f(30, "gore"), f(35, "gore", "rated_15"), f(40, "rated_15"), f(45)];
    assert.deepEqual(buildRanges(frames, 5), [
      { filter_id: "gore", start_s: 30, end_s: 40 },
      { filter_id: "rated_15", start_s: 35, end_s: 45 },
    ]);
  });

  it("does not depend on input order", () => {
    const frames = [f(2, "gore"), f(0), f(1, "gore")];
    assert.deepEqual(buildRanges(frames, 1), [{ filter_id: "gore", start_s: 1, end_s: 3 }]);
  });
});

describe("selectFilters", () => {
  const all = [
    { id: "id-gore", key: "gore", prompt: "g" },
    { id: "id-spiders", key: "spiders", prompt: "s" },
    { id: "id-15", key: "rated_15", prompt: "r" },
  ];

  it("returns every candidate when no ids are given", () => {
    assert.deepEqual(selectFilters(all, undefined), { filters: all });
  });

  it("returns only the requested filters", () => {
    assert.deepEqual(selectFilters(all, ["id-15", "id-gore"]), {
      filters: [all[0], all[2]],
    });
  });

  it("rejects unknown ids", () => {
    assert.deepEqual(selectFilters(all, ["id-gore", "id-x", "id-y"]), {
      error: "Unknown filter_ids: id-x, id-y",
    });
  });
});

describe("question names", () => {
  it("names questions f0, f1, … by position", () => {
    assert.equal(questionName(0), "f0");
    assert.equal(questionName(12), "f12");
  });

  it("maps answers back to filter ids, so two users' 'gore' filters don't collide", () => {
    const ids = ["builtin-gore", "user-gore"];
    assert.deepEqual(
      answersByFilterId(
        [
          { type: "predicate", name: "f0", probability: 0.9 },
          { type: "refusal", name: "f1" },
        ],
        ids
      ),
      [
        { type: "predicate", name: "builtin-gore", probability: 0.9 },
        { type: "refusal", name: "user-gore" },
      ]
    );
  });

  it("drops answers with unknown names", () => {
    assert.deepEqual(answersByFilterId([{ type: "predicate", name: "f5", probability: 1 }], ["a"]), []);
    assert.deepEqual(answersByFilterId([{ type: "predicate", name: "gore", probability: 1 }], ["a"]), []);
  });
});

describe("frameDecisions", () => {
  it("gives one boolean and probability per filter for every frame, sorted by time", () => {
    const frames = [
      { t: 1, flags: [], probabilities: { gore: 0.1, spiders: 0.2 } },
      { t: 0, flags: ["gore"], probabilities: { gore: 0.9, spiders: null } },
    ];
    assert.deepEqual(frameDecisions(frames, ["gore", "spiders"]), [
      { t: 0, filters: { gore: true, spiders: false }, probabilities: { gore: 0.9, spiders: null } },
      { t: 1, filters: { gore: false, spiders: false }, probabilities: { gore: 0.1, spiders: 0.2 } },
    ]);
  });

  it("reports null probabilities when none were recorded", () => {
    assert.deepEqual(frameDecisions([{ t: 0, flags: [] }], ["gore"]), [
      { t: 0, filters: { gore: false }, probabilities: { gore: null } },
    ]);
  });
});

describe("answerProbabilities", () => {
  it("maps predicates to their probability and refusals to null", () => {
    assert.deepEqual(
      answerProbabilities([
        { type: "predicate", name: "gore", probability: 0.92 },
        { type: "refusal", name: "rated_18" },
      ]),
      { gore: 0.92, rated_18: null }
    );
  });
});

describe("mockAnswers end to end", () => {
  it("yields gore 10–20 and 15+ 15–30 at 1 fps", () => {
    const filters = [
      { id: "id-15", key: "rated_15" },
      { id: "id-gore", key: "gore" },
      { id: "id-spiders", key: "spiders" },
    ];
    const frames = Array.from({ length: 40 }, (_, t) => ({
      t,
      flags: flaggedFilters(mockAnswers(t, filters), 0.5),
    }));
    assert.deepEqual(buildRanges(frames, 1), [
      { filter_id: "id-gore", start_s: 10, end_s: 20 },
      { filter_id: "id-15", start_s: 15, end_s: 30 },
    ]);
  });
});

describe("secondProbs", () => {
  it("stores every second a frame stands for, × 1000, refusals as -1", () => {
    const frames = [{ t: 4, flags: ["a"], probabilities: { a: 0.9, b: null } }];
    assert.deepEqual(secondProbs(frames, ["a", "b"], 2), [
      { filter_id: "a", s: 4, p: 900 },
      { filter_id: "a", s: 5, p: 900 },
      { filter_id: "b", s: 4, p: -1 },
      { filter_id: "b", s: 5, p: -1 },
    ]);
  });
});

describe("minutesFor", () => {
  it("lists the minute rows holding the frames' seconds", () => {
    assert.deepEqual(minutesFor([58, 59], 2), [0, 1]);
  });
});

describe("storedAnswers", () => {
  const probs = (values: Record<number, number>) =>
    Array.from({ length: 60 }, (_, i) => (i in values ? values[i] : null));
  const rows = [
    { filter_id: "a", minute: 0, probs: probs({ 1: 900, 2: 200 }) },
    { filter_id: "b", minute: 0, probs: probs({ 1: -1 }) },
  ];

  it("uses what's stored and needs nothing for a fully answered frame", () => {
    assert.deepEqual(storedAnswers([1], ["a", "b"], 1, rows, 500), {
      stored: [{ t: 1, flags: ["a", "b"], probabilities: { a: 0.9, b: null } }],
      todo: [],
    });
  });

  it("asks only the filters a frame is missing (a new filter on a scanned video)", () => {
    const { stored, todo } = storedAnswers([2], ["a", "b", "c"], 1, rows, 500);
    assert.deepEqual(stored, [{ t: 2, flags: [], probabilities: { a: 0.2 } }]);
    assert.deepEqual(todo, [{ t: 2, filterIds: ["b", "c"] }]);
  });

  it("asks every filter for an unseen frame (a new video)", () => {
    assert.deepEqual(storedAnswers([61], ["a", "b"], 1, rows, 500).todo, [{ t: 61, filterIds: ["a", "b"] }]);
  });

  it("needs every second of a longer interval", () => {
    assert.deepEqual(storedAnswers([1], ["a"], 2, rows, 500).todo, []);
    assert.deepEqual(storedAnswers([2], ["a"], 2, rows, 500).todo, [{ t: 2, filterIds: ["a"] }]);
  });
});

describe("groupByFilters", () => {
  it("groups frames needing the same filters", () => {
    assert.deepEqual(
      groupByFilters([
        { t: 1, filterIds: ["c"] },
        { t: 2, filterIds: ["a", "b"] },
        { t: 3, filterIds: ["c"] },
      ]),
      [
        { filterIds: ["c"], times: [1, 3] },
        { filterIds: ["a", "b"], times: [2] },
      ]
    );
  });
});

describe("mergeAnswers", () => {
  it("joins stored and new answers per frame", () => {
    assert.deepEqual(
      mergeAnswers([
        { t: 2, flags: [], probabilities: { a: 0.2 } },
        { t: 2, flags: ["c"], probabilities: { c: 0.8 } },
      ]),
      [{ t: 2, flags: ["c"], probabilities: { a: 0.2, c: 0.8 } }]
    );
  });
});
