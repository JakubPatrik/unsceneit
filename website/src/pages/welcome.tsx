import { ArrowRight, Pin, Puzzle } from "lucide-react"
import type { ReactNode } from "react"

import { Footer } from "@/components/site/footer"
import { Logo } from "@/components/site/logo"
import { PlayerMock } from "@/components/site/player-mock"
import { WaitlistForm } from "@/components/site/waitlist-form"
import { Xenia } from "@/components/site/xenia"
import { Button } from "@/components/ui/button"
import { FOUNDER_OFFER, FREE_LIVE_AI_MINUTES } from "@/site"

// Opened once by the extension on first install (extension/background.js), so
// it has no install buttons and isn't indexed. New installs start with no
// filters picked, which makes step 2 the one that matters.
export function Welcome() {
  return (
    <>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-[-25%] left-1/2 h-[800px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(113_107_243/0.32),transparent)]" />
        </div>

        <header className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:h-20 sm:px-6">
          <Logo />
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
          <section className="grid items-center gap-12 lg:grid-cols-[5fr_6fr]">
            <div>
              <Xenia size={56} />
              <h1 className="mt-8 text-5xl font-semibold tracking-tighter text-balance sm:text-6xl">unscene.it is installed</h1>
              <p className="mt-5 max-w-lg text-lg text-pretty text-muted-foreground">
                Xenia is ready. Pick what you&rsquo;d rather not see, and she&rsquo;ll blur those scenes while the story
                keeps playing.
              </p>
            </div>
            <PlayerMock />
          </section>

          <section className="mt-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set it up in under a minute</h2>
            <ol className="mt-8 grid gap-3 md:grid-cols-3">
              <Step
                n={1}
                title="Pin it to your toolbar"
                body="Click the puzzle icon at the top right of Chrome, then the pin next to unscene.it."
              >
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm">
                  <Puzzle className="size-4 text-muted-foreground" />
                  <img src="/icon.png" alt="" width={20} height={20} className="size-5 rounded-[5px]" />
                  unscene.it
                  <Pin className="ml-auto size-4 fill-brand-soft text-brand-soft" />
                </div>
              </Step>
              <Step
                n={2}
                title="Pick your filters"
                body="Click the unscene.it icon and choose an age limit, the scenes to hide, or both. Thumbnails are already blurred, but scenes aren't hidden until you pick."
              >
                <ul className="flex flex-wrap gap-1.5 text-xs">
                  {["Spiders", "Blood & gore", "Sensual & revealing", "Under 12"].map((filter) => (
                    <li key={filter} className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-brand-soft">
                      {filter}
                    </li>
                  ))}
                </ul>
              </Step>
              <Step
                n={3}
                title="Open a YouTube video"
                body={`It waits under a blur until you choose how to watch. Library titles are ready to go, and you get ${FREE_LIVE_AI_MINUTES} free minutes of live AI a month for the rest.`}
              >
                <Button asChild className="h-10 gap-2 rounded-full bg-foreground px-5 font-medium text-background hover:bg-foreground/90">
                  <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">
                    Open YouTube
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </Step>
            </ol>
          </section>

          <section className="mt-20 rounded-3xl border border-border bg-card/60 px-4 py-12 text-center sm:px-8">
            <p className="text-sm font-medium text-brand-soft">Early access</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Want more than {FREE_LIVE_AI_MINUTES} minutes of live AI a month?
            </h2>
            <p className="mx-auto mt-3 mb-8 max-w-xl text-pretty text-muted-foreground">
              Everyone on the waitlist gets more live AI and Pro first, with {FOUNDER_OFFER}.
            </p>
            <WaitlistForm source="welcome" />
          </section>
        </main>
      </div>
      <Footer />
    </>
  )
}

function Step({ n, title, body, children }: { n: number; title: string; body: string; children: ReactNode }) {
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-card/60 p-6">
      <span className="grid size-8 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand-soft">{n}</span>
      <h3 className="mt-5 font-medium">{title}</h3>
      <p className="mt-2 mb-6 text-sm text-pretty text-muted-foreground">{body}</p>
      <div className="mt-auto">{children}</div>
    </li>
  )
}
