import { Sparkles, Ticket, Wand2 } from "lucide-react"
import { useState } from "react"

import { Footer } from "@/components/site/footer"
import { Nav } from "@/components/site/nav"
import { WaitlistForm } from "@/components/site/waitlist-form"
import { Xenia } from "@/components/site/xenia"
import { FOUNDER_OFFER } from "@/site"

// Early access waitlist for more live AI / Pro.
const PERKS = [
  { icon: Wand2, title: "First access to live AI", body: "Screens videos that aren't in the library yet, about 10 seconds ahead of you." },
  { icon: Ticket, title: "Founding-member pricing", body: `Everyone on this list gets ${FOUNDER_OFFER}.` },
  { icon: Sparkles, title: "A say in what comes next", body: "Including your own custom filters, for the scenes the built-ins don't cover." },
]

export function Waitlist() {
  const [joined, setJoined] = useState(false)

  return (
    <>
      <Nav />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-[-25%] left-1/2 h-[800px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(113_107_243/0.32),transparent)]" />
        </div>

        <div className="mx-auto max-w-3xl px-4 pt-36 pb-24 text-center sm:px-6 sm:pt-44">
          <Xenia size={72} state={joined ? "protecting" : "thinking"} className="mx-auto" />
          <p className="mt-10 text-sm font-medium text-brand-soft">Early access</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tighter text-balance sm:text-7xl">Watch anything. Worry less.</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            In the alpha, unscene.it filters titles in its library. Live AI will screen everything else as you watch. Join
            the waitlist and we&rsquo;ll email you the moment it&rsquo;s ready.
          </p>

          <div className="mt-10">
            <WaitlistForm onJoined={() => setJoined(true)} />
          </div>

          <ul className="mt-20 grid gap-3 text-left sm:grid-cols-3">
            {PERKS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl border border-border bg-card/60 p-5">
                <Icon className="size-5 text-brand-soft" />
                <p className="mt-4 font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </>
  )
}
