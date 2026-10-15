import { CHROME_STORE_URL, COMPANY, SUPPORT_EMAIL } from "@/site"

import { Logo } from "./logo"

export function Footer() {
  const links = [
    ...(CHROME_STORE_URL ? [{ label: "Chrome Web Store", href: CHROME_STORE_URL }] : []),
    { label: "Support", href: `mailto:${SUPPORT_EMAIL}` },
    { label: "Privacy", href: "/privacy/" },
  ]
  return (
    <footer className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex flex-col gap-6 border-t border-border py-10 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <nav className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
          <span>© 2026 {COMPANY.name}</span>
        </nav>
      </div>
    </footer>
  )
}
