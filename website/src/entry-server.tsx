import { StrictMode, type ReactNode } from "react"
import { renderToString } from "react-dom/server"

import { Home } from "./pages/home"
import { NotFound } from "./pages/not-found"
import { Privacy } from "./pages/privacy"
import { Waitlist } from "./pages/waitlist"

// Build-time prerendering (scripts/prerender.mjs): each built HTML file gets
// its page's markup in #root, so crawlers, link previews and AI search see
// the content without running JavaScript. mount.tsx then hydrates it.
// Keep in sync with the *-main.tsx entries.
const PAGES: Record<string, ReactNode> = {
  "index.html": <Home />,
  "privacy/index.html": <Privacy />,
  "waitlist/index.html": <Waitlist />,
  "404.html": <NotFound />,
}

export const files = Object.keys(PAGES)

export function render(file: string): string {
  return renderToString(<StrictMode>{PAGES[file]}</StrictMode>)
}
