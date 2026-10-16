import { Analytics } from "@vercel/analytics/react"
import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"

// Renders a page into #root, with Vercel Web Analytics (cookieless page
// views; see the privacy policy). Every HTML entry uses this.
export function mount(page: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {page}
      <Analytics />
    </StrictMode>,
  )
}
