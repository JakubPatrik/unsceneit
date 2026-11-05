import { AddToChrome } from "@/components/site/add-to-chrome"
import { FeedbackForm } from "@/components/site/feedback-form"
import { Footer } from "@/components/site/footer"
import { Logo } from "@/components/site/logo"
import { Puppy } from "@/components/site/puppy"
import { Xenia } from "@/components/site/xenia"
import { SUPPORT_EMAIL } from "@/site"

// Chrome opens this when the extension is removed (setUninstallURL in
// extension/background.js), so it isn't indexed. Feedback goes to the
// public.feedback table; the reinstall link is for anyone who removed it by
// accident or wants to give it another go.
export function Uninstall() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-[-25%] left-1/2 h-[800px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(113_107_243/0.32),transparent)]" />
        </div>

        <header className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:h-20 sm:px-6">
          <Logo />
        </header>

        <main className="mx-auto grid max-w-6xl items-start gap-12 px-4 pt-8 pb-24 sm:px-6 sm:pt-12 lg:grid-cols-[5fr_6fr]">
          <section>
            <Xenia size={56} state="sad" />
            <h1 className="mt-8 text-5xl font-semibold tracking-tighter text-balance sm:text-6xl">unscene.it has been removed</h1>
            <p className="mt-5 max-w-lg text-lg text-pretty text-muted-foreground">
              Sorry it didn&rsquo;t work out. Tell us what went wrong: it only takes a few seconds, and it&rsquo;s how
              Xenia gets better.
            </p>

            <div className="mt-8">
              <Puppy />
            </div>

            <div className="mt-8 max-w-lg rounded-2xl border border-border bg-card/60 p-6">
              <h2 className="font-medium">Removed it by accident?</h2>
              <p className="mt-2 mb-5 text-sm text-pretty text-muted-foreground">
                Add it back from the Chrome Web Store. Stuck on something? Write to{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline underline-offset-4">
                  {SUPPORT_EMAIL}
                </a>{" "}
                and we&rsquo;ll help.
              </p>
              <AddToChrome size="sm" />
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card/60 p-6 sm:p-8">
            <FeedbackForm />
          </section>
        </main>
      </div>
      <Footer />
    </div>
  )
}
