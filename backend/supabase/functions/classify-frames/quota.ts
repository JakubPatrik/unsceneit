// Free live AI allowance for publishable-key callers (store builds): pure
// helpers, testable under Node. The charging itself is live_ai_reserve /
// live_ai_refund in the database (20261017000000_live_ai_quota.sql).

export type Todo = { t: number; filterIds: string[] };

export type Quota = {
  limit_s: number; // monthly allowance per install
  used_s: number; // used this month
  remaining_s: number;
  resets_at: string; // ISO time: the 1st of next month, 00:00 UTC
  ip_limited: boolean; // this network's daily allowance is used up (the install may still have seconds)
};

// Seconds of video the AI would analyse for this request: one per frame that
// still has an unanswered question.
export function secondsNeeded(todo: Todo[], intervalS: number): number {
  return new Set(todo.map((x) => x.t)).size * intervalS;
}

// Keeps the earliest frames that fit in `granted` seconds; the rest stay
// unanalysed (the extension asks again, and gets told the allowance is used up).
export function limitTodo(todo: Todo[], granted: number, intervalS: number): Todo[] {
  const times = [...new Set(todo.map((x) => x.t))].sort((a, b) => a - b);
  const kept = new Set(times.slice(0, Math.floor(granted / intervalS)));
  return todo.filter((x) => kept.has(x.t));
}

export function nextMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export function quotaInfo(installUsed: number, limit: number, ipLeft: number, now = new Date()): Quota {
  const remaining = Math.max(0, limit - installUsed);
  return {
    limit_s: limit,
    used_s: Math.min(installUsed, limit),
    remaining_s: remaining,
    resets_at: nextMonthUtc(now).toISOString(),
    ip_limited: remaining > 0 && ipLeft <= 0,
  };
}

// Salted SHA-256 of the caller's IP (hex). The raw IP is never stored.
export async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The caller's IP as the platform forwards it (first x-forwarded-for entry).
export function callerIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
