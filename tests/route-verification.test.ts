import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
// Chainable fake supabase admin client. `insert` is a spy returning {error}.
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

import { POST } from "@/app/api/verification/route";

function makeReq(body: unknown) {
  return new Request("http://x/api/verification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  requesterName: "Jane Requester",
  requesterEmail: "jane@org.com",
  organization: "Acme Co",
  subjectName: "John Counselor",
  subjectCertNumber: "CERT-123",
  reason: "Employment verification",
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

describe("POST /api/verification", () => {
  it("returns 400 on invalid JSON and never inserts", async () => {
    const res = await POST(makeReq("{not json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_json" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 missing_fields when required fields absent (no insert)", async () => {
    const res = await POST(makeReq({ requesterEmail: "a@b.com", reason: "x" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "missing_fields" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 missing_subject when neither subject name nor cert number", async () => {
    const res = await POST(
      makeReq({ ...valid, subjectName: "", subjectCertNumber: "" }),
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "missing_subject" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 invalid_email for a malformed email", async () => {
    const res = await POST(makeReq({ ...valid, requesterEmail: "not-an-email" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_email" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 too_long when a field exceeds its cap", async () => {
    const res = await POST(makeReq({ ...valid, reason: "x".repeat(4001) }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "too_long" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 429 and does not insert when rate-limited", async () => {
    checkRateLimit.mockReturnValue({ ok: false, retryAfter: 42 });
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    await expect(res.json()).resolves.toMatchObject({ error: "rate_limited" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("honeypot: silently succeeds without inserting", async () => {
    const res = await POST(makeReq({ ...valid, company_website: "bot.com" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("success path: inserts the expected row shape and returns ok", async () => {
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("verification_requests");
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        member_id: null,
        source: "public",
        requester_name: "Jane Requester",
        requester_email: "jane@org.com",
        organization: "Acme Co",
        subject_name: "John Counselor",
        subject_cert_number: "CERT-123",
        recipient_name: "Jane Requester",
        recipient_email: "jane@org.com",
        purpose: "Employment verification",
        notes: "Employment verification",
        status: "pending",
      }),
    );
  });

  it("nulls empty optional fields in the inserted row", async () => {
    await POST(makeReq({ ...valid, organization: "", subjectCertNumber: "" }));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ organization: null, subject_cert_number: null }),
    );
  });

  it("returns 502 unavailable when the insert errors", async () => {
    insertMock.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "unavailable" });
  });

  it("email is best-effort: succeeds with RESEND_API_KEY unset (no fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still returns ok when the email send throws (best-effort)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});
