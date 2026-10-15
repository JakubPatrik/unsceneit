import { cn } from "@/lib/utils"

// The app icon plus the wordmark, drawn as text so it stays crisp on dark
// backgrounds (logo.png has a dark wordmark).
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <a
      href={href}
      aria-label="unscene.it home"
      className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight text-foreground", className)}
    >
      <img src="/icon.png" alt="" width={28} height={28} className="size-7 rounded-[8px]" />
      <span className="text-[1.35rem] leading-none">
        unscene<span className="text-brand">.</span>it
      </span>
    </a>
  )
}
