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

// A single clean frame between two flagged frames of the same filter is
// treated as flagged too, so the scene doesn't flicker back on for one
// sample. Two or more clean frames in a row split the range.
export const MAX_BRIDGED_CLEAN_FRAMES = 1;

// Turns per-frame flags into skip ranges, one set per filter. Frames are
// samples `intervalS` apart: a run of flagged samples becomes one range from
// the first flagged sample to one interval past the last. A run continues
// over up to MAX_BRIDGED_CLEAN_FRAMES clean samples, but not across a gap in
// sampling (more than that many intervals between flagged samples).
// These are the exact ranges stored; the safety buffer around them is added
// when they're read (video_with_ranges), so re-analysing never trims it.
export function buildRanges(frames: ClassifiedFrame[], intervalS: number): SkipRange[] {
  const sorted = [...frames].sort((a, b) => a.t - b.t);
  const filterIds = [...new Set(sorted.flatMap((f) => f.flags))];
  const ranges: SkipRange[] = [];
  const maxStep = intervalS * (MAX_BRIDGED_CLEAN_FRAMES + 1.5);

  for (const id of filterIds) {
    let run: SkipRange | null = null;
    let lastFlaggedT = -Infinity;
    let cleanSince = 0; // clean samples since the last flagged one
    for (const f of sorted) {
      if (!f.flags.includes(id)) {
        if (run) cleanSince++;
        continue;
      }
      const bridge = run && cleanSince <= MAX_BRIDGED_CLEAN_FRAMES && f.t - lastFlaggedT <= maxStep;
      if (run && bridge) {
        run.end_s = f.t + intervalS;
      } else {
        if (run) ranges.push(run);
        run = { filter_id: id, start_s: f.t, end_s: f.t + intervalS };
      }
      lastFlaggedT = f.t;
      cleanSince = 0;
    }
    if (run) ranges.push(run);
  }

  return ranges.sort((a, b) => a.start_s - b.start_s || a.filter_id.localeCompare(b.filter_id));
}

// Answers as stored in frame_scans: whole seconds, probability × 1000
// (0–1000), -1 = refused.
export type SecondProb = { filter_id: string; s: number; p: number };
export type ScanRow = { filter_id: string; minute: number; probs: (number | null)[] };

const toPermille = (probability: number | null) => (probability === null ? -1 : Math.round(probability * 1000));

// What to save (save_frame_probs): every second a frame stands for
// ([t, t + intervalS)), for every filter.
export function secondProbs(frames: ClassifiedFrame[], filterIds: string[], intervalS: number): SecondProb[] {
  return frames.flatMap((f) =>
    filterIds.flatMap((id) =>
      Array.from({ length: intervalS }, (_, k) => ({
        filter_id: id,
        s: f.t + k,
        p: toPermille(f.probabilities?.[id] ?? null),
      }))
    )
  );
}

// The minute rows (frame_scans.minute) that hold these frames' seconds.
export function minutesFor(times: number[], intervalS: number): number[] {
  return [...new Set(times.flatMap((t) => Array.from({ length: intervalS }, (_, k) => Math.floor((t + k) / 60))))];
}

// What's already stored for each requested frame, and which filters still
// need the AI. A filter counts as answered for a frame when every second the
// frame stands for has a value for it. So a new video needs every filter, and
// a scanned video with a filter added later needs only that one.
//   stored: per frame, the answered filters (flags/probabilities for those only)
//   todo:   per frame with gaps, the filter ids to ask the AI
// thresholdPermille: flag_threshold().
export function storedAnswers(
  times: number[],
  filterIds: string[],
  intervalS: number,
  rows: ScanRow[],
  thresholdPermille: number
): { stored: ClassifiedFrame[]; todo: { t: number; filterIds: string[] }[] } {
  const valueAt = (id: string, s: number) =>
    rows.find((r) => r.filter_id === id && r.minute === Math.floor(s / 60))?.probs[s % 60] ?? null;
  const stored: ClassifiedFrame[] = [];
  const todo: { t: number; filterIds: string[] }[] = [];
  for (const t of new Set(times)) {
    const seconds = Array.from({ length: intervalS }, (_, k) => t + k);
    const answered = filterIds.filter((id) => seconds.every((s) => valueAt(id, s) !== null));
    const values = answered.map((id) => [id, valueAt(id, t)!] as const);
    stored.push({
      t,
      flags: values.filter(([, p]) => p === -1 || p >= thresholdPermille).map(([id]) => id),
      probabilities: Object.fromEntries(values.map(([id, p]) => [id, p === -1 ? null : p / 1000])),
    });
    const missing = filterIds.filter((id) => !answered.includes(id));
    if (missing.length) todo.push({ t, filterIds: missing });
  }
  return { stored, todo };
}

// Groups frames that need the same filters, so each group is one set of AI
// calls asking only those questions.
export function groupByFilters(todo: { t: number; filterIds: string[] }[]): { filterIds: string[]; times: number[] }[] {
  const groups = new Map<string, { filterIds: string[]; times: number[] }>();
  for (const { t, filterIds } of todo) {
    const key = [...filterIds].sort().join(",");
    if (!groups.has(key)) groups.set(key, { filterIds, times: [] });
    groups.get(key)!.times.push(t);
  }
  return [...groups.values()];
}

// One frame from its stored answers plus the AI's new ones (other filters).
export function mergeAnswers(parts: ClassifiedFrame[]): ClassifiedFrame[] {
  const byT = new Map<number, ClassifiedFrame>();
  for (const p of parts) {
    const f = byT.get(p.t) ?? { t: p.t, flags: [], probabilities: {} };
    f.flags.push(...p.flags.filter((id) => !f.flags.includes(id)));
    Object.assign(f.probabilities!, p.probabilities);
    byT.set(p.t, f);
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
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
