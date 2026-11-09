import { Audio, Video } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import {
  AbsoluteFill,
  Freeze,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  END_CARD_FRAMES,
  FPS,
  SOURCE_HEIGHT,
  SOURCE_WIDTH,
  TRANSITION_FRAMES,
  WIDTH,
  beatFrames,
  beatStart,
  segmentFor,
  type Beat,
  type Creative,
  type FootageSegment,
  type Music,
} from "./content";
import { HIDDEN_FRAMES, PlayerScene, type PlayerPhase } from "./PlayerScene";
import { Rise, Wordmark, Xenia } from "./primitives";
import { CLAMP, FONT_FAMILY, color } from "./theme";

// Layout. Text stays out of the platforms' UI: about 130px at the top, 120px on
// the right and 400px at the bottom.
const SIDE_MARGIN = 70;
const HEADER_TOP = 140;
const TEXT_TOP = 232;
const TEXT_WIDTH = 880;
const TEXT_HEIGHT = 340;
const BAND_TOP = 600;

/** Segments drawn in code rather than cut from footage, by name in segments.json. */
const SCENE_PHASES: Record<string, PlayerPhase> = {
  "player-playing": "playing",
  "player-blur": "blur",
};

/** How far the footage pushes in over a beat. */
const PUSH_IN = 0.03;

/**
 * Crops the landscape recording to the segment's allowlisted box. The push-in is
 * anchored to the top of the box, so a browser toolbar in the shot stays in frame,
 * and it only ever zooms in, so nothing outside the box can come into view.
 */
const Footage: React.FC<{ readonly segment: FootageSegment }> = ({
  segment,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const [x, y, width, height] = segment.crop;
  const scale = WIDTH / width;
  const lastFootageFrame = Math.round(segment.duration * FPS) - 1;
  const file = segment.source.split("/").pop();

  return (
    <div
      style={{
        position: "absolute",
        top: BAND_TOP,
        left: 0,
        width: WIDTH,
        height: height * scale,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "50% 0%",
          scale: String(
            interpolate(frame, [0, durationInFrames], [1, 1 + PUSH_IN]),
          ),
        }}
      >
        <Freeze frame={lastFootageFrame} active={(f) => f >= lastFootageFrame}>
          <Video
            src={staticFile(`footage/${file}`)}
            trimBefore={Math.round(segment.start * FPS)}
            muted
            style={{
              position: "absolute",
              left: -x * scale,
              top: -y * scale,
              width: SOURCE_WIDTH * scale,
              height: SOURCE_HEIGHT * scale,
              maxWidth: "none",
            }}
          />
        </Freeze>
      </div>
    </div>
  );
};

const BeatScene: React.FC<{
  readonly beat: Beat;
  readonly isFirst: boolean;
}> = ({ beat, isFirst }) => {
  const segment = segmentFor(beat);
  return (
    <AbsoluteFill style={{ background: color.background }}>
      {segment.kind === "scene" ? (
        <PlayerScene phase={SCENE_PHASES[beat.segment]} />
      ) : (
        <Footage segment={segment} />
      )}
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto 0",
          height: BAND_TOP,
          background: `radial-gradient(70% 90% at 50% 0%, ${color.glow}, transparent 75%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SIDE_MARGIN,
          top: HEADER_TOP,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <Xenia size={64} />
        <Wordmark fontSize={40} />
      </div>
      <div
        style={{
          position: "absolute",
          left: SIDE_MARGIN,
          top: TEXT_TOP,
          width: TEXT_WIDTH,
          height: TEXT_HEIGHT,
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* The hook is there from frame 0, since platforms can use that frame as the
          cover. Later lines wait for the crossfade, so two texts never overlap. */}
        <Rise at={isFirst ? -30 : TRANSITION_FRAMES}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.1,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            {beat.text}
          </div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

/** `allWhite` makes every piece of text white, with the button in brand purple to carry it. */
export const EndCard: React.FC<{ readonly allWhite?: boolean }> = ({
  allWhite = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 140 } });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(70% 45% at 50% 38%, ${color.glowStrong}, transparent 75%), ${color.background}`,
        alignItems: "center",
        padding: "330px 90px 0",
        textAlign: "center",
      }}
    >
      <div style={{ scale: String(interpolate(pop, [0, 1], [0.6, 1], CLAMP)) }}>
        <Xenia size={170} />
      </div>
      <Rise at={6}>
        <div
          style={{
            marginTop: 70,
            fontSize: 104,
            lineHeight: 1.05,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            textWrap: "balance",
          }}
        >
          The scenes you’ll never see.
        </div>
      </Rise>
      <Rise at={12}>
        <div
          style={{
            marginTop: 40,
            fontSize: 44,
            lineHeight: 1.3,
            color: allWhite ? "#fff" : color.muted,
            textWrap: "balance",
          }}
        >
          Pick what you’d rather not see. Xenia blurs it while the story keeps
          playing.
        </div>
      </Rise>
      <Rise at={18}>
        <div
          style={{
            marginTop: 70,
            padding: "30px 60px",
            borderRadius: 999,
            background: allWhite ? color.xenia : color.foreground,
            color: allWhite ? "#fff" : color.background,
            fontSize: 48,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Add to Chrome, free
        </div>
      </Rise>
      <Rise at={24}>
        <div style={{ marginTop: 44 }}>
          <Wordmark fontSize={56} dotColor={allWhite ? "#fff" : undefined} />
        </div>
      </Rise>
    </AbsoluteFill>
  );
};

const MUSIC_FADE_IN = 10;
const MUSIC_FADE_OUT = 40;
/** Short enough to read as a cut, long enough not to click. */
const MUTE_RAMP = 4;

/**
 * Background music, faded in and out, and muted while a code-drawn scene is
 * blurred, the way the extension's "Mute sound while hidden" works.
 */
const BackgroundMusic: React.FC<{
  readonly creative: Creative;
  readonly music: Music;
}> = ({ creative, music }) => {
  const { durationInFrames } = useVideoConfig();
  const hidden = creative.beats.flatMap((beat, i) =>
    SCENE_PHASES[beat.segment] === "blur"
      ? [
          {
            from: beatStart(creative, i) + HIDDEN_FRAMES.from,
            to: beatStart(creative, i) + HIDDEN_FRAMES.to,
          },
        ]
      : [],
  );

  return (
    <Audio
      src={staticFile(music.src)}
      trimBefore={Math.round(music.start * FPS)}
      volume={(f) => {
        const fade = interpolate(
          f,
          [
            0,
            MUSIC_FADE_IN,
            durationInFrames - MUSIC_FADE_OUT,
            durationInFrames,
          ],
          [0, 1, 1, 0],
          CLAMP,
        );
        const mute = hidden.reduce(
          (level, { from, to }) =>
            level *
            interpolate(
              f,
              [from, from + MUTE_RAMP, to, to + MUTE_RAMP],
              [1, 0, 0, 1],
              CLAMP,
            ),
          1,
        );
        return music.volume * fade * mute;
      }}
    />
  );
};

export const SocialClip: React.FC<{ readonly creative: Creative }> = ({
  creative,
}) => (
  <AbsoluteFill style={{ fontFamily: FONT_FAMILY, color: color.foreground }}>
    {creative.music ? (
      <BackgroundMusic creative={creative} music={creative.music} />
    ) : null}
    <TransitionSeries>
      {creative.beats.flatMap((beat, i) => [
        <TransitionSeries.Sequence
          key={`beat-${i}`}
          name={beat.segment}
          durationInFrames={beatFrames(beat)}
        >
          <BeatScene beat={beat} isFirst={i === 0} />
        </TransitionSeries.Sequence>,
        <TransitionSeries.Transition
          key={`transition-${i}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />,
      ])}
      <TransitionSeries.Sequence
        name="End card"
        durationInFrames={END_CARD_FRAMES}
      >
        <EndCard />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
