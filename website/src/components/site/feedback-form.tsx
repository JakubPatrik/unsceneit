import { Check, Loader2 } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/site"

// Keep the values in sync with the reason check on public.feedback (the
// feedback migration).
const REASONS = [
  { value: "missed_scenes", label: "It missed scenes I wanted hidden" },
  { value: "hid_too_much", label: "It hid scenes that were fine" },
  { value: "not_in_library", label: "My videos weren’t in the library" },
  { value: "live_ai_limit", label: "I ran out of free live AI minutes" },
  { value: "slow_or_broken", label: "It slowed down or broke YouTube" },
  { value: "hard_to_use", label: "It was too much hassle to use" },
  { value: "no_longer_needed", label: "I don’t need it any more" },
  { value: "other", label: "Something else" },
]

const MESSAGE_MAX_LENGTH = 2000

type Status = { state: "idle" } | { state: "sending" } | { state: "done"; email: string } | { state: "error"; message: string }

// The extension adds its version to the address as ?v= (read on submit: pages
// are also prerendered at build time, where there's no window).
const versionFromUrl = () => new URLSearchParams(window.location.search).get("v")

async function submitFeedback(reason: string | null, message: string, email: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_feedback`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_reason: reason,
      p_message: message || null,
      p_email: email || null,
      p_extension_version: versionFromUrl(),
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.message ?? "Something went wrong. Please try again.")
  }
}

// Needs a reason or a message. Everything else is optional.
export function FeedbackForm() {
  const [reason, setReason] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>({ state: "idle" })

  const sending = status.state === "sending"
  const trimmedMessage = message.trim()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!reason && !trimmedMessage) return
    const trimmedEmail = email.trim()
    setStatus({ state: "sending" })
    try {
      await submitFeedback(reason, trimmedMessage, trimmedEmail)
      setStatus({ state: "done", email: trimmedEmail })
    } catch (err) {
      setStatus({ state: "error", message: (err as Error).message })
    }
  }

  if (status.state === "done") {
    return (
      <div className="rounded-2xl border border-brand/40 bg-brand/10 p-6">
        <p className="flex items-center gap-2 font-medium">
          <Check className="size-5 text-brand-soft" /> Thanks for telling us
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          It helps us work out what to fix next.
          {status.email && (
            <>
              {" "}
              We&rsquo;ll reply to <span className="text-foreground">{status.email}</span>.
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <fieldset disabled={sending}>
        <legend className="font-medium">Why did you remove it?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {REASONS.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors hover:border-white/20 has-checked:border-brand/60 has-checked:bg-brand/10 has-checked:text-brand-soft has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="message" className="font-medium">
          Anything to add? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="message"
          rows={4}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder="A video it got wrong, what you expected, what would bring you back…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
          className="mt-3 rounded-xl border-white/15 bg-white/5 px-4 py-3"
        />
      </div>

      <div>
        <label htmlFor="email" className="font-medium">
          Email, if you&rsquo;d like a reply <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={sending}
          className="mt-3 h-12 rounded-xl border-white/15 bg-white/5 px-4"
        />
      </div>

      <div>
        <Button
          type="submit"
          disabled={sending || (!reason && !trimmedMessage)}
          className="h-12 gap-2 rounded-full bg-foreground px-6 text-base font-medium text-background hover:bg-foreground/90"
        >
          {sending && <Loader2 className="size-4 animate-spin" />}
          Send feedback
        </Button>
        {status.state === "error" && (
          <p role="alert" className="mt-3 text-sm text-[#ffd479]">
            {status.message}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          This isn&rsquo;t linked to your install. See our{" "}
          <a href="/privacy/" className="underline underline-offset-4 hover:text-foreground">
            privacy policy
          </a>
          .
        </p>
      </div>
    </form>
  )
}
