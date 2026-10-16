import { EyeOff, Pause, Volume2 } from "lucide-react"

import { Xenia } from "./xenia"

// A stylised video player: a dusk scene plays, a flagged stretch comes up and
// is hidden (blurred, labelled) while the timeline keeps moving, then it
// comes back. Pure CSS animation (index.css), still under reduced motion.
export function PlayerMock() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Glow behind the player */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 rounded-[3rem] sm:-inset-x-10 bg-brand/20 blur-3xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl shadow-black/60">
        {/* Window chrome */}
        <div className="flex h-10 items-center gap-2 border-b border-white/5 bg-[#0d0f16] px-4">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
          <div className="mx-auto hidden h-6 w-72 items-center justify-center rounded-md bg-white/5 text-xs text-muted-foreground sm:flex">
            youtube.com
          </div>
          <div className="w-12" />
        </div>

        <div className="relative aspect-video overflow-hidden bg-black">
          <Scene />

          {/* "Hidden: …" label, as the extension shows it */}
          <div className="scene-label absolute inset-0 grid place-items-center">
            <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm sm:text-base">
              <EyeOff className="size-4" />
              Hidden: Blood &amp; gore
            </div>
          </div>

          {/* Xenia and her speech bubble, top-right */}
          <div className="absolute top-3 right-3 flex items-center gap-3 sm:top-5 sm:right-5">
            <div className="hidden rounded-xl bg-[#0e0e14]/90 px-3.5 py-2 text-sm text-white shadow-lg sm:block">
              Xenia is protecting this video
            </div>
            <Xenia size={46} className="scale-75 sm:scale-100" />
          </div>

          {/* Controls */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-3 sm:px-6 sm:pb-4">
            <div className="relative h-1.5 rounded-full bg-white/20">
              <div className="absolute inset-y-0 left-[42%] w-[33%] rounded-full bg-brand-soft/70" title="Flagged scene" />
              <div className="scene-playhead absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow" />
            </div>
            <div className="mt-2.5 flex items-center gap-4 text-white/80">
              <Pause className="size-4 fill-current" />
              <Volume2 className="size-4" />
              <span className="text-xs tabular-nums">1:12:48 / 1:58:03</span>
              <span className="scene-flag ml-auto text-xs text-brand-soft">Muted while hidden</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// A quiet dusk landscape: layered ridges under a warm sky.
function Scene() {
  return (
    <svg
      className="scene absolute inset-0 size-full"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151a3a" />
          <stop offset="0.45" stopColor="#5a3d78" />
          <stop offset="0.7" stopColor="#d9785f" />
          <stop offset="0.85" stopColor="#f2b27a" />
        </linearGradient>
        <radialGradient id="sun" cx="0.62" cy="0.66" r="0.22">
          <stop offset="0" stopColor="#ffe3b0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffe3b0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#090a10" stopOpacity="0" />
          <stop offset="1" stopColor="#090a10" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      <rect width="1600" height="900" fill="url(#sun)" />
      <path d="M0 610 L180 520 L330 585 L520 470 L700 560 L860 500 L1040 575 L1220 485 L1400 560 L1600 500 L1600 900 L0 900 Z" fill="#3b2c55" opacity="0.85" />
      <path d="M0 690 L140 620 L310 670 L470 600 L640 680 L820 610 L1000 690 L1180 630 L1360 700 L1600 640 L1600 900 L0 900 Z" fill="#241c3b" />
      <path d="M0 780 L220 720 L420 770 L640 715 L880 790 L1100 735 L1320 795 L1600 740 L1600 900 L0 900 Z" fill="#14111f" />
      {/* A lone figure on the ridge */}
      <g fill="#0b0912" transform="translate(1000 668)">
        <circle cx="0" cy="-58" r="9" />
        <path d="M-9 -48 L9 -48 L12 -14 L6 -14 L5 22 L-5 22 L-6 -14 L-12 -14 Z" />
      </g>
      <rect width="1600" height="900" fill="url(#haze)" />
    </svg>
  )
}
