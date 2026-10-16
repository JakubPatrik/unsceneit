import { ArrowRight, Check, Loader2, Sparkles, Ticket, Wand2 } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Footer } from "@/components/site/footer"
import { Nav } from "@/components/site/nav"
import { Xenia } from "@/components/site/xenia"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FOUNDER_OFFER, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/site"

// Early access waitlist for live AI / Pro. The extension's "Turn on live AI
// filter" button opens this page with ?from=extension.
const source = new URLSearchParams(window.location.search).get("from") === "extension" ? "extension" : "website"

type Status =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "done"; email: string; position: number | null }
  | { state: "error"; message: string }

// Returns the address's place on the waitlist (1 = first to join).
async function joinWaitlist(email: string): Promise<number | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/join_waitlist`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_email: email, p_source: source }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message ?? "Something went wrong. Please try again.")
  }
  const position = await res.json().catch(() => null)
  return typeof position === "number" ? position : null
}

const PERKS = [
  { icon: Wand2, title: "First access to live AI", body: "Screens videos that aren't in the library yet, about 10 seconds ahead of you." },
  { icon: Ticket, title: "Founding-member pricing", body: `Everyone on this list gets ${FOUNDER_OFFER}.` },
  { icon: Sparkles, title: "A say in what comes next", body: "Including your own custom filters, for the scenes the built-ins don't cover." },
]

export function Waitlist() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>({ state: "idle" })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!value) return
    setStatus({ state: "sending" })
    try {
      const position = await joinWaitlist(value)
      setStatus({ state: "done", email: value, position })
    } catch (err) {
      setStatus({ state: "error", message: (err as Error).message })
    }
  }

  return (
    <>
      <Nav />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-[-25%] left-1/2 h-[800px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(113_107_243/0.32),transparent)]" />
        </div>

        <div className="mx-auto max-w-2xl px-4 pt-36 pb-24 text-center sm:px-6 sm:pt-44">
          <Xenia size={72} state={status.state === "done" ? "protecting" : "thinking"} className="mx-auto" />
          <p className="mt-10 text-sm font-medium text-brand-soft">Early access</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tighter text-balance sm:text-7xl">Watch anything. Worry less.</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            In the alpha, unscene.it filters titles in its library. Live AI will screen everything else as you watch. Join
            the waitlist and we&rsquo;ll email you the moment it&rsquo;s ready.
          </p>

          <div className="mx-auto mt-10 max-w-md">
            {status.state === "done" ? (
              <div className="relative rounded-2xl border border-brand/40 bg-brand/10 p-6 pr-32 text-left">
                {status.position != null && (
                  <p
                    className="absolute top-5 right-6 text-3xl font-semibold tracking-tight text-brand-soft tabular-nums"
                    aria-label={`You're number ${status.position} on the waitlist`}
                  >
                    #{status.position.toLocaleString("en-US")}
                  </p>
                )}
                <p className="flex items-center gap-2 font-medium">
                  <Check className="size-5 text-brand-soft" /> You&rsquo;re on the list
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  We&rsquo;ll email <span className="text-foreground">{status.email}</span> when live AI opens, with your
                  founding-member pricing.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status.state === "sending"}
                  className="h-12 rounded-full border-white/15 bg-white/5 px-5 text-base"
                />
                <Button
                  type="submit"
                  disabled={status.state === "sending"}
                  className="h-12 shrink-0 gap-2 rounded-full bg-foreground px-6 text-base font-medium text-background hover:bg-foreground/90"
                >
                  {status.state === "sending" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Join the waitlist
                  {status.state !== "sending" && <ArrowRight className="size-4" />}
                </Button>
              </form>
            )}
            {status.state === "error" && (
              <p role="alert" className="mt-3 text-sm text-[#ffd479]">
                {status.message}
              </p>
            )}
            {status.state !== "done" && (
              <p className="mt-4 text-xs text-muted-foreground">
                We&rsquo;ll only email you about unscene.it early access and Pro. Unsubscribe any time. See our{" "}
                <a href="/privacy/" className="underline underline-offset-4 hover:text-foreground">
                  privacy policy
                </a>
                .
              </p>
            )}
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
