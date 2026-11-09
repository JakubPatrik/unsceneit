import creativesFile from "../../../pipeline/content/creatives.json";
import segmentsFile from "../../../pipeline/content/segments.json";

/**
 * The pipeline's content files are the single source of truth: copy, footage
 * allowlist and crops all live there, and lint checks them before anything here
 * is rendered.
 */
export type Beat = {
  readonly segment: string;
  readonly text: string;
};

/** A licensed track in public/. `start` is where in the track the clip begins, in seconds. */
export type Music = {
  readonly src: string;
  readonly start: number;
  readonly volume: number;
};

export type Creative = {
  readonly id: string;
  readonly beats: readonly Beat[];
  readonly music?: Music;
};

export type FootageSegment = {
  readonly kind?: undefined;
  readonly source: string;
  readonly start: number;
  readonly duration: number;
  readonly hold?: number;
  readonly crop: readonly [number, number, number, number];
};

/** Drawn in code, with no footage at all. */
export type SceneSegment = {
  readonly kind: "scene";
  readonly duration: number;
  readonly hold?: number;
};

export type Segment = FootageSegment | SceneSegment;

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const SOURCE_WIDTH = 2720;
export const SOURCE_HEIGHT = 1530;

export const END_CARD_FRAMES = 90;
export const TRANSITION_FRAMES = 8;

/** Hand-edited creatives have no beats, and register their own composition in Root.tsx. */
export const creatives: readonly Creative[] = creativesFile.creatives.filter(
  (creative) => creative.beats.length > 0,
);

const segments = segmentsFile as unknown as Record<string, Segment>;

export const segmentFor = (beat: Beat): Segment => segments[beat.segment];

/** Frames on screen for one beat, including any held last frame. */
export const beatFrames = (beat: Beat): number => {
  const { duration, hold = 0 } = segmentFor(beat);
  return Math.round((duration + hold) * FPS);
};

/** The frame where a beat starts on the clip's timeline, after the crossfades before it. */
export const beatStart = (creative: Creative, index: number): number =>
  creative.beats
    .slice(0, index)
    .reduce((sum, beat) => sum + beatFrames(beat) - TRANSITION_FRAMES, 0);

/** Transitions overlap neighbouring scenes, which shortens the total. */
export const clipFrames = (creative: Creative): number => {
  const beats = creative.beats.reduce((sum, beat) => sum + beatFrames(beat), 0);
  return beats + END_CARD_FRAMES - creative.beats.length * TRANSITION_FRAMES;
};
