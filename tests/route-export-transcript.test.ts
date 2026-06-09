import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkRateLimit = vi.fn(() => ({ ok: true, retryAfter: 0 }));
const getClientIp = vi.fn(() => "1.2.3.4");
vi.mock("@/lib/public-rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...(a as [])),
  getClientIp: (...a: unknown[]) => getClientIp(...(a as [])),
}));

import { POST } from "@/app/api/assistant/export-transcript/route";

function makeReq(body: unknown) {
  return new Request("http://x/api/assistant/export-transcript", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validMessages = [
  { role: "user", content: "What is ABCAC?" },
  { role: "assistant", content: "ABCAC is a certification body." },
];

beforeEach(() => {
  checkRateLimit.mockReset();
  checkRateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
  getClientIp.mockReturnValue("1.2.3.4");
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/assistant/export-transcript", () => {
  it("returns 400 on invalid JSON", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(makeReq("{bad"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad_request" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 400 on a malformed email", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(
      makeReq({ email: "not-an-email", messages: validMessages }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad_request" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 400 on empty messages", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const res = await POST(makeReq({ email: "a@b.com", messages: [] }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad_request" });
  });

  it("returns 400 when messages is not an array", async () => {
    const res = await POST(makeReq({ email: "a@b.com", messages: "nope" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad_request" });
  });

  it("returns 400 when too many messages", async () => {
    const many = Array.from({ length: 101 }, () => ({
      role: "user",
      content: "hi",
    }));
    const res = await POST(makeReq({ email: "a@b.com", messages: many }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad_request" });
  });

  it("returns 400 when total content exceeds the size cap", async () => {
    const big = [
      { role: "user", content: "x".repeat(40_000) },
      { role: "assistant", content: "y".repeat(20_000) },
    ];
    const res = await POST(makeReq({ email: "a@b.com", messages: big }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad_request" });
  });

  it("returns 400 when a message content is not a string", async () => {
    const res = await POST(
      makeReq({
        email: "a@b.com",
        messages: [{ role: "user", content: 42 }],
      }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad_request" });
  });

  it("returns 429 with Retry-After when rate-limited (no email attempt)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    checkRateLimit.mockReturnValue({ ok: false, retryAfter: 42 });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(
      makeReq({ email: "a@b.com", messages: validMessages }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    await expect(res.json()).resolves.toMatchObject({ error: "rate_limited" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 503 email_not_configured when RESEND_API_KEY is unset", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(
      makeReq({ email: "a@b.com", messages: validMessages }),
    );
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      error: "email_not_configured",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns 200 and sends the correct Resend payload on success", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const res = await POST(
      makeReq({
        email: "visitor@example.com",
        messages: [
          { role: "user", content: "Hello\n<there>" },
          { role: "assistant", content: "Hi & welcome" },
        ],
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer re_test");

    const payload = JSON.parse(init.body as string);
    expect(payload.from).toBe("ABCAC <noreply@abcac.org>");
    expect(payload.to).toBe("visitor@example.com");
    expect(payload.subject).toBe("Your ABCAC questions & answers");
    // HTML escaped + labelled + line breaks preserved.
    expect(payload.html).toContain("Your ABCAC questions &amp; answers");
    expect(payload.html).toContain("<strong>You:</strong>");
    expect(payload.html).toContain("<strong>ABCAC Assistant:</strong>");
    expect(payload.html).toContain("Hello<br />&lt;there&gt;");
    expect(payload.html).toContain("Hi &amp; welcome");
    // No raw unescaped injection.
    expect(payload.html).not.toContain("<there>");
  });

  it("returns 502 delivery_failed when Resend responds non-ok", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 422 }),
    );
    const res = await POST(
      makeReq({ email: "a@b.com", messages: validMessages }),
    );
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "delivery_failed" });
  });

  it("returns 502 delivery_failed when the email send throws", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const res = await POST(
      makeReq({ email: "a@b.com", messages: validMessages }),
    );
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "delivery_failed" });
  });
});
