import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const insertMock = vi.fn(async () => ({ data: null, error: null as unknown }));
const fromMock = vi.fn(() => ({ insert: insertMock }));
const createSupabaseAdminClient = vi.fn(() => ({ from: fromMock }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

// The board-application route does not call the public rate-limiter, but mock it
// defensively so the suite stays decoupled from limiter state.
vi.mock("@/lib/public-rate-limit", () => ({
  checkRateLimit: () => ({ ok: true, retryAfter: 0 }),
  getClientIp: () => "1.2.3.4",
}));

import { POST } from "@/app/api/board-application/route";

function makeReq(body: unknown) {
  return new Request("http://x/api/board-application", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  fullName: "Jane Applicant",
  preferredName: "Jane",
  email: "jane@example.com",
  phone: "555-9999",
  whyJoin: "I want to give back.",
  certifications: ["LISAC", "LADC"],
  certificationOther: "",
};

beforeEach(() => {
  insertMock.mockClear();
  insertMock.mockResolvedValue({ data: null, error: null });
  fromMock.mockClear();
  createSupabaseAdminClient.mockClear();
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/board-application", () => {
  it("returns 400 on invalid JSON and never inserts", async () => {
    const res = await POST(makeReq("{bad"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_json" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("returns 400 missing_fields when required fields absent (no insert)", async () => {
    const res = await POST(makeReq({ fullName: "Jane", email: "j@e.com" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "missing_fields" });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("success (email unset): persists a text summary to supabase", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled(); // no RESEND_API_KEY => no email attempt
    expect(fromMock).toHaveBeenCalledWith("contact_messages");
    expect(insertMock).toHaveBeenCalledTimes(1);
    const row = insertMock.mock.calls[0][0] as Record<string, string>;
    expect(row.name).toBe("Jane Applicant");
    expect(row.email).toBe("jane@example.com");
    expect(row.phone).toBe("555-9999");
    expect(row.message).toContain("BOARD MEMBER APPLICATION");
    expect(row.message).toContain("Why join the Board: I want to give back.");
    expect(row.message).toContain("Certifications: LISAC, LADC");
  });

  it("records attachment filenames in the fallback summary (content dropped)", async () => {
    await POST(
      makeReq({
        ...valid,
        attachments: [
          { filename: "resume.pdf", content: "base64data" },
          { filename: "", content: "x" }, // invalid -> filtered out
        ],
      }),
    );
    const row = insertMock.mock.calls[0][0] as Record<string, string>;
    expect(row.message).toContain("Attachments submitted: resume.pdf");
  });

  it("always persists AND emails when Resend succeeds", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledTimes(1); // persisted regardless of email
  });

  it("still returns ok (persisted) when the email send throws", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 delivery_unavailable when neither insert nor email works", async () => {
    insertMock.mockResolvedValue({ data: null, error: { message: "no table" } });
    const res = await POST(makeReq(valid));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "delivery_unavailable" });
  });
});
