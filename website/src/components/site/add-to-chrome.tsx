import { ArrowUpRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CHROME_STORE_URL } from "@/site"

// The main call to action: a white pill, like the rest of the site's
// primary buttons. Until the store listing exists it says so instead of
// linking nowhere.
export function AddToChrome({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const classes = cn(
    "rounded-full bg-foreground font-medium text-background hover:bg-foreground/90",
    size === "lg" ? "h-12 gap-2 px-7 text-base" : "h-9 gap-1.5 px-4 text-sm",
    className,
  )

  if (!CHROME_STORE_URL) {
    return (
      <Button disabled className={cn(classes, "disabled:opacity-100 bg-foreground/90")}>
        Coming soon to Chrome
      </Button>
    )
  }

  return (
    <Button asChild className={classes}>
      <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
        <Plus className={size === "lg" ? "size-5" : "size-4"} />
        Add to Chrome
        {size === "lg" && <ArrowUpRight className="size-4 opacity-60" />}
      </a>
    </Button>
  )
}
