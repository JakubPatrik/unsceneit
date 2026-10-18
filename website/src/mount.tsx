import { Analytics } from "@vercel/analytics/react"
import { StrictMode, type ReactNode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"

import "./index.css"

// Renders a page into #root, with Vercel Web Analytics (cookieless page
// views; see the privacy policy). Every HTML entry uses this. Built pages
// arrive prerendered (entry-server.tsx) and are hydrated; the dev server
// serves an empty #root and renders from scratch.
export function mount(page: ReactNode) {
  const root = document.getElementById("root")!
  const tree = (
    <StrictMode>
      {page}
      <Analytics />
    </StrictMode>
  )
  if (root.hasChildNodes()) hydrateRoot(root, tree)
  else createRoot(root).render(tree)
}
