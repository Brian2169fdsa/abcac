import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  checkConversationLength,
  callerIp,
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
} from "@/lib/assistant/rate-limit";

describe("rate limiter (WP-D)", () => {
  it("allows the first N requests then 429s within a minute", () => {
    const key = `test:${Math.random()}`;
    let lastOk = true;
    let blocked = false;
    for (let i = 0; i < 30; i++) {
      const r = checkRateLimit(key);
      if (!r.ok) {
        blocked = true;
        expect(r.retryAfter).toBeGreaterThan(0);
        expect(r.reason).toBeDefined();
        break;
      }
      lastOk = r.ok;
    }
    expect(lastOk).toBe(true);
    expect(blocked).toBe(true);
  });

  it("keys are isolated per caller", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    // Exhaust a's minute budget.
    for (let i = 0; i < 30; i++) checkRateLimit(a);
    // b should still be allowed on its first request.
    expect(checkRateLimit(b).ok).toBe(true);
  });
});

describe("callerIp", () => {
  it("uses the first x-forwarded-for hop", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(callerIp(req)).toBe("1.2.3.4");
  });

  it("falls back to 'unknown' without headers", () => {
    expect(callerIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("conversation length guardrail", () => {
  it("accepts a normal conversation", () => {
    expect(checkConversationLength([{ content: "hello" }]).ok).toBe(true);
  });

  it("rejects too many messages", () => {
    const msgs = Array.from({ length: MAX_MESSAGES + 1 }, () => ({ content: "hi" }));
    expect(checkConversationLength(msgs).ok).toBe(false);
  });

  it("rejects an over-long single message", () => {
    const big = "x".repeat(MAX_MESSAGE_CHARS + 1);
    const res = checkConversationLength([{ content: big }]);
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
