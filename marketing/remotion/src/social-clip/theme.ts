import { loadFont } from "@remotion/fonts";
import { Easing, staticFile } from "remotion";

export const FONT_FAMILY = "Geist";

loadFont({
  family: FONT_FAMILY,
  url: staticFile("fonts/geist.woff2"),
  weight: "100 900",
});

export const EASE = Easing.bezier(0.4, 0, 0.2, 1);

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** Brand colours from store/promo.html, which match website/src/index.css. */
export const color = {
  background: "#090a10",
  foreground: "#f2f2f7",
  muted: "#b8b8c8",
  brand: "#716bf3",
  xenia: "#5b4cf0",
  glow: "rgb(113 107 243 / 0.34)",
  glowStrong: "rgb(113 107 243 / 0.42)",
} as const;
