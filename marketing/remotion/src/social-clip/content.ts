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

export type Creative = {
  readonly id: string;
  readonly beats: readonly Beat[];
};

export type Segment = {
  readonly source: string;
  readonly start: number;
  readonly duration: number;
  readonly hold?: number;
  readonly crop: readonly [number, number, number, number];
};

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;
export const SOURCE_WIDTH = 2720;
export const SOURCE_HEIGHT = 1530;

export const END_CARD_FRAMES = 90;
export const TRANSITION_FRAMES = 8;

export const creatives: readonly Creative[] = creativesFile.creatives;

const segments = segmentsFile as unknown as Record<string, Segment>;

export const segmentFor = (beat: Beat): Segment => segments[beat.segment];

/** Frames on screen for one beat, including any held last frame. */
export const beatFrames = (beat: Beat): number => {
  const { duration, hold = 0 } = segmentFor(beat);
  return Math.round((duration + hold) * FPS);
};

/** Transitions overlap neighbouring scenes, which shortens the total. */
export const clipFrames = (creative: Creative): number => {
  const beats = creative.beats.reduce((sum, beat) => sum + beatFrames(beat), 0);
  return beats + END_CARD_FRAMES - creative.beats.length * TRANSITION_FRAMES;
};
