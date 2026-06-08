// Lightweight in-memory abuse protection for the PUBLIC, unauthenticated POST
// endpoints (/api/contact, /api/verification). This is the v1: a per-IP
// fixed-window limiter held in module-local memory.
//
// NOTE: in-memory state is per serverless instance and resets on cold start, so
// it does NOT provide durable, cross-instance limiting. For production-grade
// guarantees across Vercel's many instances, back this with Vercel KV / Upstash
// Redis (atomic INCR + EXPIRE per IP). The interface here is intentionally small
// so it can be swapped for a KV-backed implementation later.

export interface RateLimitRule {
  /** Max requests permitted within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed (false => should return 429). */
  ok: boolean;
  /** Seconds the caller should wait before retrying (for Retry-After). */
  retryAfter: number;
}

// Default limits: ~5/min and ~20/hour per IP. Both must pass.
export const DEFAULT_RULES: RateLimitRule[] = [
  { limit: 5, windowMs: 60_000 }, // 5 per minute
  { limit: 20, windowMs: 60 * 60_000 }, // 20 per hour
];

interface WindowState {
  count: number;
  resetAt: number; // epoch ms when the current window expires
}

// key = `${bucketName}:${ip}:${windowMs}` -> window state
const store = new Map<string, WindowState>();

// Opportunistic cleanup so the map does not grow unbounded under churn.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  store.forEach((state, key) => {
    if (state.resetAt <= now) store.delete(key);
  });
}

/**
 * Extract the client IP from `x-forwarded-for`. Vercel/edge proxies prepend the
 * real client IP as the first entry. Falls back to a constant so the limiter
 * still applies (shared bucket) when no header is present.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Check (and consume) one unit against the given rules for an IP within a named
 * bucket. Returns `ok: false` with a `retryAfter` (seconds) when any rule is
 * exceeded.
 */
export function checkRateLimit(
  bucket: string,
  ip: string,
  rules: RateLimitRule[] = DEFAULT_RULES,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  // Evaluate every rule first; only consume if all pass, so a request blocked by
  // the tighter window does not also burn the looser window's quota.
  const states: { key: string; state: WindowState }[] = [];
  for (const rule of rules) {
    const key = `${bucket}:${ip}:${rule.windowMs}`;
    let state = store.get(key);
    if (!state || state.resetAt <= now) {
      state = { count: 0, resetAt: now + rule.windowMs };
      store.set(key, state);
    }
    if (state.count >= rule.limit) {
      return { ok: false, retryAfter: Math.ceil((state.resetAt - now) / 1000) };
    }
    states.push({ key, state });
  }

  for (const { state } of states) state.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Test-only: clear all limiter state. */
export function __resetRateLimitStore() {
  store.clear();
  lastSweep = 0;
}
