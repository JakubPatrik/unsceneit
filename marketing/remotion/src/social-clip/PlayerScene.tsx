import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
} from "remotion";
import { TRANSITION_FRAMES, beatFrames } from "./content";
import { Xenia } from "./primitives";
import { CLAMP, EASE, color } from "./theme";

/**
 * A video player drawn entirely in code, so the product's main moment can be
 * shown without third-party film: a scene is blurred for exactly 2 seconds under
 * a label, while the timecode keeps running, and then the picture comes back.
 *
 * The two phases are two beats with a crossfade between them, so the picture,
 * playhead and timecode are driven by one continuous clock across both.
 */
export type PlayerPhase = "playing" | "blur";

// Layout, inside the footage band (y >= 600) and clear of the bottom 400px.
const PLAYER_TOP = 640;
const PLAYER_LEFT = 40;
const PICTURE_WIDTH = 1000;
const PICTURE_HEIGHT = 562;
const CONTROLS_HEIGHT = 100;

// A made-up 1:48:00 movie with three flagged scenes, as fractions of its length.
const MOVIE_SECONDS = 6480;
const MARKS = [
  { at: 0.48, width: 0.008 },
  { at: 0.66, width: 0.012 },
  { at: 0.83, width: 0.006 },
] as const;

// The playing phase scrubs through the movie, easing to a stop just before the
// first flagged scene. The blur phase is real time from there.
const PLAYHEAD_START = 0.06;
const PLAYHEAD_BEFORE_MARK = 0.476;
const SECONDS_BEFORE_MARK = 1;

// In the blur phase's own frames: the scene starts at BLUR_START and lasts
// exactly 2 seconds, matching the line on screen.
const BLUR_START = 30;
const BLUR_FRAMES = 60;
const BLUR_RAMP = 8;
const BLUR_PX = 42;

/**
 * While the scene is hidden, in the blur beat's own frames: from the blur
 * starting to the picture starting to come back. Music mutes over this window,
 * like the extension's "Mute sound while hidden".
 */
export const HIDDEN_FRAMES = {
  from: BLUR_START,
  to: BLUR_START + BLUR_FRAMES,
} as const;

/** Where the blur phase starts on the shared clock. */
const BLUR_OFFSET =
  beatFrames({ segment: "player-playing", text: "" }) - TRANSITION_FRAMES;
const FPS = 30;
const MARK_SECONDS = Math.round(MOVIE_SECONDS * MARKS[0].at);

const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

/** Playhead position (0-1), timecode (seconds) and blur amount (0-1) for one frame. */
const playerState = (phase: PlayerPhase, frame: number) => {
  if (phase === "playing") {
    const progress = interpolate(frame, [0, BLUR_OFFSET], [0, 1], {
      ...CLAMP,
      easing: Easing.out(Easing.cubic),
    });
    const startSeconds = MOVIE_SECONDS * PLAYHEAD_START;
    const endSeconds = MARK_SECONDS - SECONDS_BEFORE_MARK;
    return {
      playhead: interpolate(
        progress,
        [0, 1],
        [PLAYHEAD_START, PLAYHEAD_BEFORE_MARK],
      ),
      seconds: interpolate(progress, [0, 1], [startSeconds, endSeconds]),
      blur: 0,
    };
  }

  // Real time: the playhead crosses the flagged mark in the 2 seconds it's blurred.
  const seconds = MARK_SECONDS + (frame - BLUR_START) / FPS;
  const mark = MARKS[0];
  const playhead = interpolate(
    frame,
    [0, BLUR_START, BLUR_START + BLUR_FRAMES, BLUR_START + BLUR_FRAMES + 45],
    [
      PLAYHEAD_BEFORE_MARK,
      mark.at,
      mark.at + mark.width,
      mark.at + mark.width + 0.004,
    ],
  );
  const blurEnd = BLUR_START + BLUR_FRAMES;
  const blur = interpolate(
    frame,
    [BLUR_START, BLUR_START + BLUR_RAMP, blurEnd, blurEnd + BLUR_RAMP],
    [0, 1, 1, 0],
    { ...CLAMP, easing: EASE },
  );
  return { playhead, seconds, blur };
};

/** Warm candlelit bokeh and two silhouettes: reads as "a film", shows nothing real. */
const Picture: React.FC<{ readonly clock: number }> = ({ clock }) => {
  const lights = Array.from({ length: 18 }, (_, i) => {
    const r = 16 + random(`r-${i}`) * 46;
    const hue = 26 + random(`h-${i}`) * 20;
    const twinkle =
      0.75 + 0.25 * Math.sin(clock / 14 + random(`t-${i}`) * 6.28);
    return {
      x: random(`x-${i}`) * PICTURE_WIDTH,
      y: 30 + random(`y-${i}`) * PICTURE_HEIGHT * 0.55,
      r,
      color: `hsl(${hue} 95% 62% / ${(0.45 + random(`a-${i}`) * 0.45) * twinkle})`,
      depth: 0.4 + random(`d-${i}`) * 0.8,
    };
  });

  const figure = (left: number, scale: number) => (
    <div
      style={{
        position: "absolute",
        left,
        bottom: 0,
        width: 300 * scale,
        height: 380 * scale,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 120 * scale,
          height: 140 * scale,
          translate: "-50% 0",
          borderRadius: "50%",
          background: "#0b0605",
          boxShadow: `inset ${-10 * scale}px 0 ${24 * scale}px rgb(255 160 80 / 0.28)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: `${130 * scale}px 0 0 0`,
          borderRadius: `${140 * scale}px ${140 * scale}px 0 0`,
          background: "#0b0605",
          boxShadow: `inset ${-14 * scale}px ${10 * scale}px ${30 * scale}px rgb(255 160 80 / 0.22)`,
        }}
      />
    </div>
  );

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(80% 70% at 62% 35%, #6b3517 0%, #2a120a 55%, #100705 100%)",
      }}
    >
      {lights.map((light, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: light.x - light.r - clock * 0.18 * light.depth,
            top: light.y - light.r,
            width: light.r * 2,
            height: light.r * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${light.color} 0%, ${light.color} 42%, transparent 70%)`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          translate: `${-clock * 0.08}px 0`,
        }}
      >
        {figure(150, 1)}
        {figure(640, 0.88)}
      </div>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgb(0 0 0 / 0.6))",
        }}
      />
    </AbsoluteFill>
  );
};

const PauseIcon: React.FC = () => (
  <div style={{ display: "flex", gap: 9 }}>
    {[0, 1].map((bar) => (
      <div
        key={bar}
        style={{
          width: 9,
          height: 32,
          borderRadius: 2,
          background: color.foreground,
        }}
      />
    ))}
  </div>
);

/** `label` names the filter on the "Hidden:" pill. */
export const PlayerScene: React.FC<{
  readonly phase: PlayerPhase;
  readonly label?: string;
}> = ({ phase, label = "Blood & gore" }) => {
  const frame = useCurrentFrame();
  const clock = phase === "playing" ? frame : BLUR_OFFSET + frame;
  const { playhead, seconds, blur } = playerState(phase, frame);
  const labelPop = interpolate(blur, [0.5, 1], [0, 1], CLAMP);
  const inMark = blur > 0;

  return (
    <div
      style={{
        position: "absolute",
        top: PLAYER_TOP,
        left: PLAYER_LEFT,
        width: PICTURE_WIDTH,
        borderRadius: 28,
        overflow: "hidden",
        background: "#000",
        border: "1px solid rgb(255 255 255 / 0.08)",
        boxShadow: `0 40px 120px rgb(0 0 0 / 0.6), 0 0 90px ${color.glow}`,
      }}
    >
      <div
        style={{
          position: "relative",
          height: PICTURE_HEIGHT,
          overflow: "hidden",
        }}
      >
        <AbsoluteFill
          style={{
            // Scaling up while blurred hides the soft, dark edges a blur leaves.
            scale: String(1 + 0.12 * blur),
            filter: `blur(${BLUR_PX * blur}px) brightness(${1 - 0.4 * blur}) saturate(${1 - 0.3 * blur})`,
          }}
        >
          <Picture clock={clock} />
        </AbsoluteFill>

        {/* Xenia's badge, top right, as in the real player. */}
        <div
          style={{
            position: "absolute",
            top: 26,
            right: 26,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              opacity: labelPop,
              fontSize: 24,
              color: color.foreground,
              textShadow: "0 1px 6px rgb(0 0 0 / 0.6)",
            }}
          >
            Xenia is protecting this video
          </div>
          <Xenia size={64} />
        </div>

        {/* The label the extension shows over a hidden scene. */}
        <AbsoluteFill
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <div
            style={{
              opacity: labelPop,
              translate: `0 ${interpolate(labelPop, [0, 1], [18, 0])}px`,
              padding: "14px 30px",
              borderRadius: 999,
              background: "rgb(16 16 24 / 0.82)",
              border: "1px solid rgb(255 255 255 / 0.1)",
              fontSize: 32,
              fontWeight: 500,
              color: color.foreground,
            }}
          >
            Hidden: {label}
          </div>
        </AbsoluteFill>
      </div>

      {/* Controls: progress bar with the flagged scenes, then pause and timecode. */}
      <div
        style={{
          height: CONTROLS_HEIGHT,
          padding: "22px 30px 0",
          background: "#0d0d12",
        }}
      >
        <div style={{ position: "relative", height: 10 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              background: "rgb(255 255 255 / 0.2)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${playhead * 100}%`,
              borderRadius: 999,
              background: "#ff2b3d",
            }}
          />
          {MARKS.map((mark, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: -4,
                left: `${mark.at * 100}%`,
                width: `max(${mark.width * 100}%, 8px)`,
                height: 18,
                borderRadius: 4,
                background: color.brand,
                boxShadow:
                  i === 0 && inMark
                    ? `0 0 ${24 * blur}px ${color.brand}`
                    : "none",
              }}
            />
          ))}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: `${playhead * 100}%`,
              width: 26,
              height: 26,
              translate: "-50% -50%",
              borderRadius: "50%",
              background: "#ff2b3d",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 22,
            display: "flex",
            alignItems: "center",
            gap: 30,
            fontSize: 28,
            fontVariantNumeric: "tabular-nums",
            color: color.muted,
          }}
        >
          <PauseIcon />
          <span>
            <span style={{ color: color.foreground }}>
              {formatTime(seconds)}
            </span>
            {" / "}
            {formatTime(MOVIE_SECONDS)}
          </span>
        </div>
      </div>
    </div>
  );
};
