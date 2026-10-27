import {
  ArrowDown,
  ArrowRight,
  Bug,
  Check,
  ChevronDown,
  CloudOff,
  Droplet,
  EyeOff,
  ImageOff,
  LoaderCircle,
  PauseCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  VolumeX,
} from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { AddToChrome } from "@/components/site/add-to-chrome"
import { Footer } from "@/components/site/footer"
import { Nav } from "@/components/site/nav"
import { PlayerMock } from "@/components/site/player-mock"
import { Xenia, type XeniaState } from "@/components/site/xenia"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FOUNDER_OFFER, FREE_LIVE_AI_MINUTES, SUPPORT_EMAIL, YOUTUBE_DEMO_ID } from "@/site"

export function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Filters />
        <Demo />
        <HowItWorks />
        <LiveAi />
        <MeetXenia />
        <Details />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}

// ---- Building blocks ----

function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32", className)}>
      {children}
    </section>
  )
}

function Heading({ eyebrow, title, lead }: { eyebrow?: string; title: ReactNode; lead?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="mb-4 text-sm font-medium text-brand-soft">{eyebrow}</p>}
      <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">{title}</h2>
      {lead && <p className="mt-5 text-lg text-pretty text-muted-foreground">{lead}</p>}
    </div>
  )
}

// Secondary call to action next to the install button.
function WaitlistButton() {
  return (
    <Button
      asChild
      variant="outline"
      className="h-12 gap-2 rounded-full border-white/15 bg-white/5 px-7 text-base font-medium hover:bg-white/10"
    >
      <a href="/waitlist/">
        Join the waitlist
        <ArrowRight className="size-4 opacity-70" />
      </a>
    </Button>
  )
}

function SoonBadge({ label = "Coming soon" }: { label?: string }) {
  return (
    <Badge variant="outline" className="border-brand/40 bg-brand/10 text-brand-soft">
      {label}
    </Badge>
  )
}

function AlphaBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-sm text-brand-soft",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-brand-soft" />
      Early alpha
    </span>
  )
}

// ---- Sections ----

function Hero() {
  return (
    <section className="relative overflow-hidden pt-36 pb-24 sm:pt-48 sm:pb-32">
      {/* Background: a violet dusk glow over the ink */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-20%] left-1/2 h-[900px] w-[1400px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(113_107_243/0.35),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.06)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] bg-[size:24px_24px]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          <AlphaBadge />
          <a
            href="#live-ai"
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm transition-colors hover:bg-white/10"
          >
            <span className="rounded-full bg-xenia px-1.5 py-px text-xs font-semibold text-white">New</span>
            {FREE_LIVE_AI_MINUTES} free minutes of live AI, every month
            <ArrowRight className="size-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
        <h1 className="text-5xl leading-[1.02] font-semibold tracking-tighter text-balance sm:text-7xl md:text-8xl">
          The scenes you&rsquo;ll never see.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg text-pretty text-muted-foreground sm:text-xl">
          A YouTube content filter for Chrome. It blurs the scenes you choose (gore, spiders, 18+ content, or anything
          above your family&rsquo;s age limit) while the story keeps playing.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <AddToChrome />
            <WaitlistButton />
          </div>
          <p className="text-sm text-muted-foreground">Free during the early alpha: every video in the library, plus {FREE_LIVE_AI_MINUTES} minutes of live AI a month for the rest. YouTube, Chrome on desktop.</p>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <a href="#demo" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <Play className="size-3.5 fill-current" /> Watch the 1-min demo
          </a>
          <a href="#how" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            See how it works <ArrowDown className="size-4" />
          </a>
        </div>
      </div>

      <div className="mt-16 px-4 sm:mt-20 sm:px-6">
        <PlayerMock />
      </div>
    </section>
  )
}

function Demo() {
  return (
    <Section id="demo">
      <Heading
        eyebrow="See it in action"
        title="One minute. Real videos."
        lead="A horror trailer, minus the gore. Then Xenia screens a video nobody has checked yet, live, as it plays."
      />
      <div className="mx-auto mt-12 max-w-5xl">
        <DemoVideo />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <a
            href={`https://www.youtube.com/watch?v=${YOUTUBE_DEMO_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Watch on YouTube
          </a>
        </p>
      </div>
    </Section>
  )
}

const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com"

// Shows the local poster and loads YouTube's player (privacy-enhanced mode)
// only once someone presses play, so the page stays light and cookie-free.
// The poster stays on top until the player reports it's playing, so there's
// no black flash while YouTube loads.
function DemoVideo() {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle")
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (state !== "loading") return
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== "string") return
      try {
        const { event, info } = JSON.parse(e.data)
        if ((event === "onStateChange" && info === 1) || (event === "infoDelivery" && info?.playerState === 1)) {
          setState("playing")
        }
      } catch {
        // Not a player message.
      }
    }
    window.addEventListener("message", onMessage)
    // Autoplay can be blocked (some phones): then show YouTube's own play button.
    const fallback = setTimeout(() => setState("playing"), 4000)
    return () => {
      window.removeEventListener("message", onMessage)
      clearTimeout(fallback)
    }
  }, [state])

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/60">
      {state !== "idle" && (
        <iframe
          ref={frame}
          className="absolute inset-0 size-full"
          src={`${YOUTUBE_EMBED_ORIGIN}/embed/${YOUTUBE_DEMO_ID}?autoplay=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`}
          title="unscene.it in one minute"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          // Subscribe to the player's state, as YouTube's iframe API does.
          onLoad={(e) =>
            e.currentTarget.contentWindow?.postMessage(
              JSON.stringify({ event: "listening", id: YOUTUBE_DEMO_ID, channel: "widget" }),
              YOUTUBE_EMBED_ORIGIN,
            )
          }
        />
      )}
      <button
        type="button"
        onClick={() => setState("loading")}
        disabled={state !== "idle"}
        aria-label="Play the one-minute demo"
        className={cn(
          "group absolute inset-0 grid cursor-pointer place-items-center bg-black transition-opacity duration-500",
          state === "playing" && "pointer-events-none opacity-0",
        )}
      >
        <img
          src="/demo-poster.jpg"
          alt=""
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover opacity-75 transition-opacity group-hover:opacity-90"
        />
        <span className="relative grid size-20 place-items-center rounded-full bg-xenia text-white shadow-[0_0_60px_rgb(91_76_240/0.6)] transition-transform group-hover:scale-105">
          {state === "idle" ? (
            <Play className="size-8 translate-x-0.5 fill-current" />
          ) : (
            <LoaderCircle className="size-8 animate-spin" />
          )}
        </span>
      </button>
    </div>
  )
}

const FILTERS = [
  { icon: ShieldCheck, title: "Age limit", detail: "Under 12, Under 15 or Under 18" },
  { icon: Droplet, title: "Blood & gore", detail: "Wounds, injuries, graphic violence" },
  { icon: Bug, title: "Spiders & insects", detail: "Even small or partly visible" },
  { icon: EyeOff, title: "Sensual & revealing", detail: "Nudity, revealing outfits, suggestive dancing" },
]

function Filters() {
  return (
    <Section>
      <Heading
        title="Your filters. Your household."
        lead="Turn on any combination. One viewer hides only spiders; another hides gore, anything sensual and anything over 12."
      />

      <div className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FILTERS.map(({ icon: Icon, title, detail }) => (
          <div key={title} className="rounded-2xl border border-border bg-card/60 p-5">
            <Icon className="size-5 text-brand-soft" />
            <p className="mt-4 font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>

      {/* Lines from each card into Xenia (desktop) */}
      <svg
        className="hidden h-24 w-full text-white/15 lg:block"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        {[125, 375, 625, 875].map((x) => (
          <path key={x} d={`M${x} 0 C ${x} 60, 500 40, 500 100`} stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      <div className="mx-auto mt-6 flex max-w-md items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[0_0_60px_rgb(113_107_243/0.18)] lg:mt-0">
        <Xenia size={40} />
        <div className="h-10 w-px bg-border" />
        <div>
          <p className="font-medium">Only what you chose is hidden</p>
          <p className="text-sm text-muted-foreground">Everything else plays as normal.</p>
        </div>
      </div>

    </Section>
  )
}

function HowItWorks() {
  return (
    <Section id="how">
      <Heading eyebrow="How it works" title="Three steps. Then just watch." />

      <div className="mt-16 grid gap-4 lg:grid-cols-3">
        <Step n={1} title="Pick your filters" body="In the extension menu, or right on the video. Your choice syncs across your Chrome.">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-white/10 bg-secondary px-3 py-1.5 text-sm">Under 12 ▾</span>
            {["Blood & gore", "Spiders & insects"].map((c) => (
              <span key={c} className="rounded-full bg-xenia px-3 py-1.5 text-sm font-medium text-white">
                {c}
              </span>
            ))}
            <span className="rounded-full border border-white/10 bg-secondary px-3 py-1.5 text-sm text-muted-foreground">
              Sensual &amp; revealing
            </span>
          </div>
        </Step>

        <Step
          n={2}
          title="Choose how to watch"
          body="Every video waits, blurred, until you decide. Xenia checks it against the unscene.it library first."
        >
          <div className="rounded-xl border border-white/10 bg-[#0e0e14] p-4">
            <p className="text-xs font-bold text-brand-soft">unscene.it</p>
            <p className="mt-1 text-sm font-medium">
              <span className="text-[#5fe0a0]">✓</span> Found in the library
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">3 scenes will be hidden for your filters.</p>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="rounded-lg border border-white/10 bg-secondary px-2.5 py-1.5">Watch unfiltered</span>
              <span className="rounded-lg bg-xenia px-2.5 py-1.5 font-semibold text-white">Watch with filters</span>
            </div>
          </div>
        </Step>

        <Step
          n={3}
          title="Watch without worry"
          body="Flagged scenes are blurred, muted and labelled. When the scene ends, picture and sound come back. Nothing is cut."
        >
          <div className="relative grid h-[106px] place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#5a3d78,#d9785f)]">
            <div className="absolute inset-0 backdrop-blur-xl backdrop-brightness-50" />
            <span className="relative flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold">
              <EyeOff className="size-3.5" /> Hidden: Spiders &amp; insects
            </span>
          </div>
        </Step>
      </div>
    </Section>
  )
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
      <span className="grid size-8 place-items-center rounded-full border border-border text-sm text-muted-foreground">{n}</span>
      <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <div className="mt-8 flex flex-1 items-end">
        <div className="w-full">{children}</div>
      </div>
    </div>
  )
}

// Free live AI for videos not in the library: every install's monthly
// allowance (FREE_LIVE_AI_MINUTES), with a mock of the extension menu's meter.
const LIVE_AI_POINTS = [
  `${FREE_LIVE_AI_MINUTES} free minutes every month, refilled on the 1st`,
  "No account, no card",
  "Minutes left are always in the menu, and when you hover Xenia",
]

function LiveAi() {
  const left = 17
  return (
    <Section id="live-ai" className="py-12 sm:py-16">
      <div className="relative overflow-hidden rounded-[2rem] border border-brand/40 bg-[linear-gradient(135deg,rgb(113_107_243/0.22),rgb(113_107_243/0.03)_65%)] p-6 sm:p-12 lg:p-14">
        <div className="pointer-events-none absolute -top-40 -right-40 size-120 rounded-full bg-[radial-gradient(closest-side,rgb(113_107_243/0.35),transparent)]" />

        <div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-brand-soft">
              <Sparkles className="size-4" /> Free for everyone
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Not in the library? Xenia screens it live.
            </h2>
            <p className="mt-5 text-lg text-pretty text-muted-foreground">
              Turn on live AI and Xenia watches about 10 seconds ahead of you, hiding what you chose before it reaches
              the screen. Every browser gets{" "}
              <strong className="font-semibold text-foreground">{FREE_LIVE_AI_MINUTES} minutes free each month</strong>,
              enough for a typical YouTube video.
            </p>
            <ul className="mt-8 space-y-3">
              {LIVE_AI_POINTS.map((point) => (
                <li key={point} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-soft" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-10">
              <AddToChrome />
            </div>
          </div>

          {/* The extension menu's live AI meter, plus Xenia at work */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-white/10 bg-[#0e0e14] p-5 shadow-[0_20px_80px_rgb(0_0_0/0.5)]">
              <p className="text-xs font-bold text-brand-soft">unscene.it</p>
              <div className="mt-4 rounded-xl border border-brand-soft/45 bg-[linear-gradient(135deg,rgb(107_76_255/0.3),rgb(107_76_255/0.1))] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-bold tracking-wider text-brand-soft uppercase">Free live AI</span>
                  <span className="text-2xl font-bold tabular-nums">{left} min left</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#6b4cff,#b8a8ff)]"
                    style={{ width: `${(100 * left) / FREE_LIVE_AI_MINUTES}%` }}
                  />
                </div>
                <p className="mt-2.5 text-xs text-[#d6d6e2]">
                  of your {FREE_LIVE_AI_MINUTES} free minutes this month · refills on the 1st
                </p>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-secondary/60 p-3">
                <Xenia size={32} state="thinking" />
                <div>
                  <p className="text-sm font-medium">Screening the next 10 seconds…</p>
                  <p className="text-xs text-muted-foreground">Live AI · this video isn&rsquo;t in the library yet</p>
                </div>
              </div>
            </div>
            <span className="absolute -top-3 -right-3 rotate-6 rounded-full bg-xenia px-3 py-1 text-sm font-semibold text-white shadow-lg">
              {FREE_LIVE_AI_MINUTES} min / month free
            </span>
          </div>
        </div>
      </div>
    </Section>
  )
}

const XENIA_STATES: { state: XeniaState; label: string; detail: ReactNode }[] = [
  { state: "protecting", label: "Protecting", detail: "Purple, with the odd sideways glance. Your filters are on." },
  { state: "off", label: "Resting", detail: "Grey. You're watching without filters, and she stays out of the way." },
  {
    state: "thinking",
    label: "Thinking",
    detail: (
      <>
        A spinning ring while she screens the next seconds with live AI.{" "}
        <SoonBadge label={`${FREE_LIVE_AI_MINUTES} min free a month`} />
      </>
    ),
  },
]

function MeetXenia() {
  return (
    <Section>
      <div className="grid items-center gap-16 lg:grid-cols-2">
        <div className="relative mx-auto grid aspect-square w-full max-w-md place-items-center">
          <div className="absolute inset-8 rounded-full bg-[radial-gradient(closest-side,rgb(91_76_240/0.45),transparent)] blur-2xl" />
          <div className="absolute inset-0 rounded-full border border-white/5" />
          <div className="absolute inset-12 rounded-full border border-white/5" />
          <Xenia size={168} className="relative" />
          <div className="absolute top-[16%] right-0 rounded-xl bg-[#0e0e14]/90 px-3.5 py-2 text-sm shadow-lg sm:right-[-4%]">
            Xenia is protecting this video
          </div>
        </div>

        <div>
          <p className="mb-4 text-sm font-medium text-brand-soft">Meet Xenia</p>
          <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Your guardian in the corner.</h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Xenia sits quietly in the corner of the player and keeps watch, so you don&rsquo;t have to. She hides only what
            you asked her to and never judges the rest. Click her any time to change your filters.
          </p>
          <ul className="mt-10 space-y-6">
            {XENIA_STATES.map(({ state, label, detail }) => (
              <li key={state} className="flex gap-4">
                <Xenia size={32} state={state} className="mt-0.5" />
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

const DETAILS = [
  { icon: EyeOff, title: "Heavy blur", body: "Flagged scenes are blurred so strongly that nothing shows through." },
  { icon: VolumeX, title: "Muted while hidden", body: "Sound drops out with the picture and comes back on its own. On by default, and one switch to turn off." },
  { icon: PauseCircle, title: "Nothing plays until you choose", body: "No autoplay surprises: each video waits under a blur for your decision." },
  { icon: ImageOff, title: "YouTube thumbnails blurred too", body: "Thumbnails and hover previews are blurred before they show, so a graphic thumbnail can't catch you off guard." },
  { icon: RefreshCw, title: "Settings that follow you", body: "Your filters sync across every Chrome where you're signed in." },
  { icon: CloudOff, title: "No video files uploaded", body: "unscene.it looks videos up by their ID or title. Live AI checks still frames only, and never keeps them." },
]

function Details() {
  return (
    <Section>
      <Heading title="Quiet by design." lead="The little things that make it feel like nothing happened." />
      <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {DETAILS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-background p-6 sm:p-8">
            <Icon className="size-5 text-brand-soft" />
            <p className="mt-4 font-medium">{title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Pricing() {
  return (
    <Section>
      <Heading
        title="Free during the alpha."
        lead="Popular movies and videos are screened once and shared, so filtering them costs you nothing."
      />
      <div className="mx-auto mt-16 grid max-w-4xl gap-4 md:grid-cols-2">
        <PlanCard
          name="Free"
          price="$0"
          note="Early alpha. No account needed."
          items={[
            "Unlimited filtering on every title in the library",
            `${FREE_LIVE_AI_MINUTES} minutes of live AI a month for videos not in the library yet`,
            "All filters, in any combination",
            "Heavy blur, with optional mute",
            "Thumbnail blur",
          ]}
          cta={<AddToChrome size="sm" className="w-full" />}
        />
        <PlanCard
          name="Pro"
          price="Credits"
          note={`Prepaid. Join the waitlist for ${FOUNDER_OFFER}.`}
          badge={<SoonBadge label="Planned" />}
          highlight
          items={[
            `More live AI, beyond the free ${FREE_LIVE_AI_MINUTES} minutes a month`,
            "Create your own filters",
          ]}
          cta={
            <Button asChild variant="outline" className="h-9 w-full rounded-full border-brand/40 bg-transparent hover:bg-brand/10">
              <a href="/waitlist/">Join the early access waitlist</a>
            </Button>
          }
        />
      </div>
    </Section>
  )
}

function PlanCard({
  name,
  price,
  note,
  items,
  badge,
  cta,
  highlight = false,
}: {
  name: string
  price: string
  note: string
  items: string[]
  badge?: ReactNode
  cta?: ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-3xl border p-6 sm:p-8",
        highlight ? "border-brand/40 bg-[linear-gradient(180deg,rgb(113_107_243/0.12),transparent_60%)]" : "border-border bg-card/60",
      )}
    >
      <div className="flex items-center gap-2">
        <p className="font-medium">{name}</p>
        {badge}
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight">{price}</p>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      <ul className="mt-8 flex-1 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm">
            {highlight ? (
              <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-soft" />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0 text-brand-soft" />
            )}
            {item}
          </li>
        ))}
      </ul>
      {cta && <div className="mt-8">{cta}</div>}
    </div>
  )
}

const FAQ = [
  {
    q: "Does unscene.it cut scenes out?",
    a: "No. Flagged scenes are blurred (and muted, unless you turn that off) while the video keeps playing, with a label such as “Hidden: gore”. Nothing is skipped, so you never lose your place in the story.",
  },
  {
    q: "Which sites does it work on?",
    a: "YouTube, including YouTube videos embedded on other websites. Other video sites, and streaming services such as Netflix and Disney+, aren't supported yet.",
  },
  {
    q: "What if a video isn't in the library?",
    a: `Xenia tells you, and you can turn on live AI: she screens the video about 10 seconds ahead of you as it plays. Every browser gets ${FREE_LIVE_AI_MINUTES} free minutes a month, refilled on the 1st, and the menu shows how many are left. You can also search the library in case it's listed under another name, or watch without filters.`,
  },
  {
    q: "How do I blur YouTube thumbnails?",
    a: "Install unscene.it and it's on by default: every YouTube thumbnail and hover preview is blurred before it can show, including Shorts and search results. You can switch the blur off in the extension menu.",
  },
  {
    q: "Can it hide spiders for arachnophobia?",
    a: "Yes. Turn on the Spiders & insects filter and scenes with spiders, even small or partly visible ones, are blurred and muted while the video plays. Blood & gore works the same way for people avoiding that trigger.",
  },
  {
    q: "Is unscene.it a parental control?",
    a: "It's a content filter that families use to make YouTube safer to watch together: pick an age limit (Under 12, Under 15 or Under 18) and the triggers to hide. It isn't a parental lock, though: anyone using the browser can change the filters or turn them off.",
  },
  {
    q: "Is it perfect?",
    a: "No filter is. Scenes are judged by AI, frame by frame, and it can occasionally miss a scene or hide a harmless one. unscene.it helps you avoid what you chose, but it can't guarantee it.",
  },
  {
    q: "Does anyone watch my videos?",
    a: "No person ever does. unscene.it looks each video up in the library by its ID or title. With live AI on, still frames are checked by AI and never kept. No video files are uploaded, and you don't need an account.",
  },
  {
    q: "What data does the extension send?",
    a: (
      <>
        Only what it needs: the video&rsquo;s YouTube ID to find it in the library, anything you type into the library
        search, and, only with live AI on, still frames from that video to be checked. Nothing is sold or used for
        ads. The{" "}
        <a href="/privacy/" className="text-foreground underline underline-offset-4">
          privacy policy
        </a>{" "}
        has the details.
      </>
    ),
  },
  {
    q: "What does early alpha mean?",
    a: (
      <>
        unscene.it works today for titles in its library, and for {FREE_LIVE_AI_MINUTES} minutes of live AI a month
        on everything else, all free. More live AI and your own custom filters come later with Pro.{" "}
        <a href="/waitlist/" className="text-foreground underline underline-offset-4">
          Join the waitlist
        </a>{" "}
        to get them first, with founding-member pricing. Tell us what you&rsquo;d like next at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline underline-offset-4">
          {SUPPORT_EMAIL}
        </a>
        .
      </>
    ),
  },
  {
    q: "Which browsers are supported?",
    a: "Chrome on desktop. Edge, Firefox and others are planned.",
  },
]

function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-24">
        <div>
          <p className="mb-4 text-sm font-medium text-brand-soft">Questions</p>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-6xl">Before you install.</h2>
        </div>
        {/* Native <details>, so every answer is in the prerendered HTML for
            search engines; name= keeps one open at a time. */}
        <div className="border-t border-border">
          {FAQ.map(({ q, a }) => (
            <details key={q} name="faq" className="faq-item group border-b border-border">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-lg py-6 text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <h3>{q}</h3>
                <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-6 text-base text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground">
                {a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_100%,rgb(113_107_243/0.35),transparent)]" />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-32 text-center sm:px-6 sm:py-40">
        <Xenia size={56} />
        <h2 className="mt-10 text-5xl font-semibold tracking-tighter text-balance sm:text-7xl">Watch together. Worry less.</h2>
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <AddToChrome />
            <WaitlistButton />
          </div>
          <p className="text-sm text-muted-foreground">Free during the early alpha.</p>
        </div>
      </div>
    </section>
  )
}
