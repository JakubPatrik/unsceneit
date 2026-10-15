import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

import { AddToChrome } from "./add-to-chrome"
import { Logo } from "./logo"

// Transparent over the hero; frosted once the page scrolls.
export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled ? "border-b border-border bg-background/75 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="hidden rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-xs text-brand-soft sm:inline-block">Alpha</span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-6">
          <a href="/#how" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block">
            How it works
          </a>
          <a href="/#faq" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block">
            Questions
          </a>
          <AddToChrome size="sm" />
        </nav>
      </div>
    </header>
  )
}
