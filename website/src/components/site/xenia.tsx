import { cn } from "@/lib/utils"

export type XeniaState = "protecting" | "off" | "thinking" | "sad"

const LABELS: Record<XeniaState, string> = {
  protecting: "Xenia, protecting",
  off: "Xenia, resting",
  thinking: "Xenia, thinking",
  sad: "Xenia, looking sad",
}

// Xenia, the unscene.it mascot: a flat round face with two white pill eyes
// that blink. Purple while protecting, grey when off, a spinning ring while
// she's thinking, droopy eyes when sad (the uninstall page).
// Proportions match the extension's 46px bot.
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
      aria-label={LABELS[state]}
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
