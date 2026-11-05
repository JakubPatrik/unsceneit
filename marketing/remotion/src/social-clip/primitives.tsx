import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CLAMP, color } from "./theme";

const BLINK_EVERY = 96;
const GLANCE_EVERY = 150;

/**
 * Xenia as STORY.md describes her: a flat purple face with two white pill eyes
 * that blink, and an occasional sideways glance while she's protecting a video.
 */
export const Xenia: React.FC<{ readonly size: number }> = ({ size }) => {
  const frame = useCurrentFrame();

  const blinkAt = frame % BLINK_EVERY;
  const eyeOpen = interpolate(blinkAt, [72, 75, 78], [1, 0.12, 1], CLAMP);

  const glanceAt = frame % GLANCE_EVERY;
  const glance = interpolate(glanceAt, [30, 38, 62, 70], [0, 1, 1, 0], CLAMP);

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        borderRadius: "50%",
        background: color.xenia,
        boxShadow: `0 ${size * 0.12}px ${size * 0.44}px rgb(91 76 240 / 0.55)`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: size * 0.155,
          translate: `${size * (0.03 + glance * 0.07)}px 0`,
        }}
      >
        {[0, 1].map((eye) => (
          <div
            key={eye}
            style={{
              width: size * 0.135,
              height: size * 0.26,
              borderRadius: 999,
              background: "#fff",
              scale: `1 ${eyeOpen}`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const Wordmark: React.FC<{ readonly fontSize: number }> = ({ fontSize }) => (
  <span style={{ fontSize, fontWeight: 600, letterSpacing: "-0.02em" }}>
    unscene<span style={{ color: color.brand }}>.</span>it
  </span>
);

/** Fades and rises into place with a settled spring, `at` frames into its scene. */
export const Rise: React.FC<{
  readonly at?: number;
  readonly distance?: number;
  readonly children: React.ReactNode;
}> = ({ at = 0, distance = 36, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - at,
    fps,
    config: { damping: 200 },
    durationInFrames: 18,
  });
  return (
    <div
      style={{
        opacity: interpolate(frame - at, [0, 8], [0, 1], CLAMP),
        translate: `0 ${interpolate(progress, [0, 1], [distance, 0])}px`,
      }}
    >
      {children}
    </div>
  );
};
