// Pure helpers for classify-frames (no Deno/network APIs) so they can be
// unit-tested with Node: see ranges.test.ts.

export type ClassifiedFrame = {
  t: number;
  flags: string[];
  // Raw predicate probability per filter id; null = refusal.
  probabilities?: Record<string, number | null>;
};
export type SkipRange = { filter_id: string; start_s: number; end_s: number };

export type DecisionAnswer =
  | { type: "predicate"; name: string; probability: number }
  | { type: "refusal"; name: string }
  | { type: string; name: string };

// Filter ids flagged by one Decisions API response. A refusal counts as
// flagged: for a safety filter, skipping too much beats showing the scene.
export function flaggedFilters(answers: DecisionAnswer[], threshold: number): string[] {
  return answers
    .filter(
      (a) =>
        a.type === "refusal" ||
        (a.type === "predicate" && "probability" in a && a.probability >= threshold)
    )
    .map((a) => a.name);
}

// Probability per filter id from one Decisions API response (null for a
// refusal), for debugging thresholds.
export function answerProbabilities(answers: DecisionAnswer[]): Record<string, number | null> {
  return Object.fromEntries(
    answers.map((a) => [a.name, "probability" in a ? a.probability : null])
  );
}

// Turns per-frame flags into skip ranges, one set per filter. Frames are
// samples `intervalS` apart: a run of flagged samples (each within 1.5
// intervals of the previous) becomes one range from the first flagged
// sample to one interval past the last.
export function buildRanges(frames: ClassifiedFrame[], intervalS: number): SkipRange[] {
  const sorted = [...frames].sort((a, b) => a.t - b.t);
  const filterIds = [...new Set(sorted.flatMap((f) => f.flags))];
  const ranges: SkipRange[] = [];

  for (const id of filterIds) {
    let run: SkipRange | null = null;
    let lastT = -Infinity;
    for (const f of sorted) {
      if (!f.flags.includes(id)) {
        if (run) ranges.push(run);
        run = null;
        continue;
      }
      if (run && f.t - lastT <= intervalS * 1.5) {
        run.end_s = f.t + intervalS;
      } else {
        if (run) ranges.push(run);
        run = { filter_id: id, start_s: f.t, end_s: f.t + intervalS };
      }
      lastT = f.t;
    }
    if (run) ranges.push(run);
  }

  return ranges.sort((a, b) => a.start_s - b.start_s || a.filter_id.localeCompare(b.filter_id));
}

// Decisions API question names are "f0", "f1", … (filter keys aren't unique
// across users and ids may not be valid names); this maps answers back to
// the filter ids they were asked for.
export function questionName(index: number): string {
  return `f${index}`;
}

export function answersByFilterId(answers: DecisionAnswer[], filterIds: string[]): DecisionAnswer[] {
  return answers.flatMap((a) => {
    const match = /^f(\d+)$/.exec(a.name);
    const id = match ? filterIds[Number(match[1])] : undefined;
    return id ? [{ ...a, name: id }] : [];
  });
}

// Filters to evaluate, from the candidates (`available`): all of them, or only
// the requested ids (e.g. the viewer's active presets in live mode, so we
// only pay for those). Returns an error message for unknown ids.
export function selectFilters<T extends { id: string }>(
  available: T[],
  ids: string[] | undefined
): { filters: T[] } | { error: string } {
  if (!ids) return { filters: available };
  const unknown = ids.filter((id) => !available.some((f) => f.id === id));
  if (unknown.length) return { error: `Unknown filter_ids: ${unknown.join(", ")}` };
  return { filters: available.filter((f) => ids.includes(f.id)) };
}

// Per-frame output keyed by filter id:
// { t, filters: { <id>: true, ... }, probabilities: { <id>: 0.92, ... } }.
export function frameDecisions(frames: ClassifiedFrame[], filterIds: string[]) {
  return [...frames]
    .sort((a, b) => a.t - b.t)
    .map((f) => ({
      t: f.t,
      filters: Object.fromEntries(filterIds.map((id) => [id, f.flags.includes(id)])),
      probabilities: Object.fromEntries(
        filterIds.map((id) => [id, f.probabilities?.[id] ?? null])
      ),
    }));
}

// Deterministic stand-in for the Decisions API (MOCK_DECISIONS=true), named
// by filter id: gore 10–20s and 15+ 15–30s (by key), i.e. overlapping ranges
// with different filters.
export function mockAnswers(t: number, filters: { id: string; key: string }[]): DecisionAnswer[] {
  const flagged = (key: string) =>
    (key === "gore" && t >= 10 && t < 20) || (key === "rated_15" && t >= 15 && t < 30);
  return filters.map((f) => ({
    type: "predicate",
    name: f.id,
    probability: flagged(f.key) ? 0.95 : 0.02,
  }));
}
