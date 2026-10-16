import { ArrowLeft } from "lucide-react"

import { Footer } from "@/components/site/footer"
import { Nav } from "@/components/site/nav"
import { Xenia } from "@/components/site/xenia"
import { Button } from "@/components/ui/button"

// Served by Vercel (and `vite preview`) for any URL that isn't a page.
export function NotFound() {
  return (
    <>
      <Nav />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-[-25%] left-1/2 h-[800px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(113_107_243/0.22),transparent)]" />
        </div>

        <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-4 pt-32 pb-24 text-center sm:px-6">
          <div className="relative">
            <p
              aria-hidden="true"
              className="text-[9rem] leading-none font-semibold tracking-tighter text-white/5 blur-[2px] select-none sm:text-[13rem]"
            >
              404
            </p>
            <Xenia size={72} state="off" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">This scene doesn&rsquo;t exist.</h1>
          <p className="mt-5 max-w-md text-lg text-pretty text-muted-foreground">
            Xenia looked everywhere. The page you&rsquo;re after was moved, or it was never here.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild className="h-11 gap-2 rounded-full bg-foreground px-6 text-base font-medium text-background hover:bg-foreground/90">
              <a href="/">
                <ArrowLeft className="size-4" />
                Back to home
              </a>
            </Button>
            <Button asChild variant="ghost" className="h-11 rounded-full px-6 text-base text-muted-foreground hover:text-foreground">
              <a href="/waitlist/">Join the waitlist</a>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
