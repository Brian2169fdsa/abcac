/**
 * WP-D — Rate limiting + spend/length guardrails for /api/assistant.
 *
 * IN-MEMORY v1. This limiter lives in module scope, so it is per-instance only.
 * On Vercel (multiple serverless instances / cold starts) the counters are NOT
 * shared, so this is a best-effort soft limit, not a hard guarantee. For durable
 * multi-instance limiting, back this with Vercel KV / Upstash Redis (swap the
 * `bump()` storage for an atomic INCR + EXPIRE). The shape below is intentionally
 * simple so that swap is localized.
 *
 * Applies to ALL surfaces (public/member/admin):
 *  - Per-caller rate limit: N requests / minute (key = IP for public, user id for
 *    authed).
 *  - Soft daily cap: M requests / day per caller.
 *  - Spend/length guardrails (see consts below): cap conversation turns and
 *    reject overly long inputs so a single request can't run up the bill. The
 *    per-request token ceiling is enforced separately by ASSISTANT_MAX_TOKENS.
 */

/** Requests allowed per caller per rolling minute. */
const PER_MINUTE_LIMIT = 12;
/** Soft cap: requests allowed per caller per rolling 24h. */
const PER_DAY_LIMIT = 200;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Max number of sanitized history messages the route will accept. */
export const MAX_MESSAGES = 40;
/** Max characters in a single message turn. */
export const MAX_MESSAGE_CHARS = 8_000;
/** Max total characters across the whole conversation we'll send upstream. */
export const MAX_TOTAL_CHARS = 24_000;

interface Window {
  count: number;
  resetAt: number;
}

interface CallerState {
  minute: Window;
  day: Window;
}

const buckets = new Map<string, CallerState>();

/** Periodically drop fully-expired callers so the map can't grow unbounded. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;
  const expired: string[] = [];
  buckets.forEach((state, key) => {
    if (state.day.resetAt <= now && state.minute.resetAt <= now) {
      expired.push(key);
    }
  });
  for (const key of expired) buckets.delete(key);
}

function bumpWindow(win: Window | undefined, now: number, span: number): Window {
  if (!win || win.resetAt <= now) {
    return { count: 1, resetAt: now + span };
  }
  return { count: win.count + 1, resetAt: win.resetAt };
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry (only meaningful when !ok). */
  retryAfter: number;
  reason?: "per_minute" | "per_day";
}

/**
 * Record one request for `key` and decide whether it is allowed. Call exactly
 * once per inbound request, BEFORE doing expensive work.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const prev = buckets.get(key);
  const minute = bumpWindow(prev?.minute, now, MINUTE_MS);
  const day = bumpWindow(prev?.day, now, DAY_MS);
  buckets.set(key, { minute, day });

  if (minute.count > PER_MINUTE_LIMIT) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((minute.resetAt - now) / 1000)),
      reason: "per_minute",
    };
  }
  if (day.count > PER_DAY_LIMIT) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((day.resetAt - now) / 1000)),
      reason: "per_day",
    };
  }
  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP from common proxy headers (Vercel sets x-forwarded-for). */
export function callerIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export interface LengthCheck {
  ok: boolean;
  error?: string;
}

/**
 * Spend guardrail: reject conversations that are too long (too many turns or too
 * much text) so a single call can't balloon the input bill. Returns ok=false
 * with a user-facing message → the route should answer 400.
 */
export function checkConversationLength(
  messages: Array<{ content: unknown }>,
): LengthCheck {
  if (messages.length > MAX_MESSAGES) {
    return {
      ok: false,
      error: `This conversation is too long (max ${MAX_MESSAGES} messages). Please start a new chat.`,
    };
  }
  let total = 0;
  for (const m of messages) {
    const text = typeof m.content === "string" ? m.content : "";
    if (text.length > MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        error: `That message is too long (max ${MAX_MESSAGE_CHARS} characters). Please shorten it.`,
      };
    }
    total += text.length;
  }
  if (total > MAX_TOTAL_CHARS) {
    return {
      ok: false,
      error: "This conversation has grown too large. Please start a new chat.",
    };
  }
  return { ok: true };
}
