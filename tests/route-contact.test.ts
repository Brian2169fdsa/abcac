import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insertMock = vi.fn(async () => ({ data: null, error: null as unknown }));
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createSupabaseAdminClient = vi.fn(() => ({ from: fromMock }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

const checkRateLimit = vi.fn(() => ({ ok: true, retryAfter: 0 }));
const getClientIp = vi.fn(() => "1.2.3.4");
vi.mock("@/lib/public-rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...(a as [])),
  getClientIp: (...a: unknown[]) => getClientIp(...(a as [])),
}));

import { POST } from "@/app/api/contact/route";

function makeReq(body: unknown) {
  return new Request("http://x/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  name: "Jane Visitor",
  email: "jane@example.com",
  phone: "555-1234",
  message: "Hello, I have a question.",
};

beforeEach(() => {
  insertMock.mockClear();
  insertMock.mockResolvedValue({ data: null, error: null });
  fromMock.mockClear();
  createSupabaseAdminClient.mockClear();
  checkRateLimit.mockReset();
  checkRateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
  getClientIp.mockReturnValue("1.2.3.4");
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/contact", () => {
  it("returns 400 on invalid JSON and never inserts", async () => {
    const res = await POST(makeReq("{bad"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_json" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 missing_fields when required fields absent (no insert)", async () => {
    const res = await POST(makeReq({ email: "a@b.com" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "missing_fields" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 too_long when a field exceeds its cap", async () => {
    const res = await POST(makeReq({ ...valid, message: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "too_long" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 429 and does not insert when rate-limited", async () => {
    checkRateLimit.mockReturnValue({ ok: false, retryAfter: 30 });
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    await expect(res.json()).resolves.toMatchObject({ error: "rate_limited" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("honeypot: silently succeeds without inserting or emailing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(makeReq({ ...valid, company_website: "bot" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("success (email unset): falls back to supabase insert with the right shape", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled(); // no RESEND_API_KEY => no email attempt
    expect(fromMock).toHaveBeenCalledWith("contact_messages");
    expect(insertMock).toHaveBeenCalledWith({
      name: "Jane Visitor",
      email: "jane@example.com",
      phone: "555-1234",
      message: "Hello, I have a question.",
    });
  });

  it("nulls phone when omitted in the fallback insert", async () => {
    await POST(makeReq({ name: "A", email: "a@b.com", message: "hi" }));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null }),
    );
  });

  it("email best-effort: returns ok via email path when Resend succeeds (no insert)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("falls back to supabase when the email send throws", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 delivery_unavailable when neither email nor insert works", async () => {
    insertMock.mockResolvedValue({ data: null, error: { message: "no table" } });
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "delivery_unavailable" });
  });
});
