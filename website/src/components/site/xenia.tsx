import { cn } from "@/lib/utils"

export type XeniaState = "protecting" | "off" | "thinking"

// Xenia, the unscene.it mascot: a flat round face with two white pill eyes
// that blink. Purple while protecting, grey when off, a spinning ring while
// she's thinking. Proportions match the extension's 46px bot.
export function Xenia({
  size = 46,
  state = "protecting",
  className,
}: {
  size?: number
  state?: XeniaState
  className?: string
}) {
  const k = size / 46
  return (
    <div
      role="img"
      aria-label={state === "off" ? "Xenia, resting" : state === "thinking" ? "Xenia, thinking" : "Xenia, protecting"}
      data-state={state}
      className={cn("xenia shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <div className="eyes" style={{ gap: 7 * k }}>
        <span className="eye" style={{ width: 6 * k, height: 11 * k }} />
        <span className="eye" style={{ width: 6 * k, height: 11 * k }} />
      </div>
    </div>
  )
}
