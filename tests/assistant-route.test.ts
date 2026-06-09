import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for POST /api/assistant (src/app/api/assistant/route.ts).
 *
 * We mock:
 *  - @anthropic-ai/sdk so the tool loop never hits the network (fake client
 *    returns a single end_turn turn with text).
 *  - @/lib/supabase/server so we control auth.getUser() + the profile lookup
 *    that resolves portal_role.
 *  - @/lib/assistant/rate-limit so we can force 429 / 400 paths deterministically.
 *
 * The key assertions cover the surface→toolset routing, the 503/401/429/400
 * status gating, and that a member requesting the "admin" surface still gets the
 * MEMBER toolset (admin tools only when isAdminRole passes).
 */

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { create };
  }
  return { default: Anthropic };
});

// Mutable auth/profile state the fake supabase clients read from.
let authUser: { id: string; email?: string } | null = null;
let profileRow: Record<string, unknown> | null = null;

function makeServerClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: authUser } }),
    },
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: vi.fn(self),
        eq: vi.fn(self),
        maybeSingle: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
      });
      return chain;
    }),
  };
}

const createSupabaseServerClient = vi.fn(makeServerClient);
const createSupabaseAdminClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

// Rate-limit + length guards: default to permissive; individual tests override.
const checkRateLimit = vi.fn(() => ({ ok: true, retryAfter: 0 }));
const checkConversationLength = vi.fn(() => ({ ok: true as boolean, error: undefined as string | undefined }));

vi.mock("@/lib/assistant/rate-limit", () => ({
  checkRateLimit: (key: string) => checkRateLimit(key),
  callerIp: () => "1.2.3.4",
  checkConversationLength: (m: unknown) => checkConversationLength(m as never),
}));

import { POST } from "@/app/api/assistant/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/assistant", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

function endTurn(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
  authUser = null;
  profileRow = null;
  create.mockResolvedValue(endTurn("hello from assistant"));
  checkRateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
  checkConversationLength.mockReturnValue({ ok: true, error: undefined });
});

describe("POST /api/assistant — configuration gate", () => {
  it("503 when ANTHROPIC_API_KEY is unset", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(req({ surface: "website", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "assistant_not_configured" });
  });
});

describe("POST /api/assistant — request validation", () => {
  it("400 on invalid JSON body", async () => {
    const bad = new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
  });

  it("400 when there are no usable messages", async () => {
    const res = await POST(req({ surface: "website", messages: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
  });

  it("400 when the conversation-length guard rejects the input", async () => {
    checkConversationLength.mockReturnValue({ ok: false, error: "too long" });
    const res = await POST(req({ surface: "website", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("input_too_large");
    expect(body.message).toBe("too long");
  });
});

describe("POST /api/assistant — website (public) surface", () => {
  it("serves the public assistant with no session and returns reply + actions", async () => {
    const res = await POST(req({ surface: "website", messages: [{ role: "user", content: "fees?" }] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("hello from assistant");
    expect(Array.isArray(body.actions)).toBe(true);
    // No Supabase session was ever consulted for the public surface.
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    // The public surface uses the website toolset (a no-DB read-only set).
    const sentTools = create.mock.calls[0][0].tools as Array<{ name: string }>;
    const names = sentTools.map((t) => t.name).sort();
    expect(names).toEqual(["list_certifications", "lookup_fees", "suggest_page"]);
  });

  it("429 when the per-IP rate limit is exceeded", async () => {
    checkRateLimit.mockReturnValue({ ok: false, retryAfter: 30 });
    const res = await POST(req({ surface: "website", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect((await res.json()).error).toBe("rate_limited");
    expect(checkRateLimit).toHaveBeenCalledWith("ip:1.2.3.4");
  });
});

describe("POST /api/assistant — authenticated surfaces", () => {
  it("401 when there is no session (member surface)", async () => {
    authUser = null;
    const res = await POST(req({ surface: "member", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("401 when an unauthenticated caller requests the admin surface", async () => {
    authUser = null;
    const res = await POST(req({ surface: "admin", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(401);
  });

  it("429 rate-limits authed callers per user id", async () => {
    authUser = { id: "user-1" };
    // First call (per the route) is the auth user limit.
    checkRateLimit.mockReturnValue({ ok: false, retryAfter: 15 });
    const res = await POST(req({ surface: "member", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("user:user-1");
  });

  it("a signed-in member gets the MEMBER toolset", async () => {
    authUser = { id: "user-1", email: "m@x.com" };
    profileRow = { portal_role: "member", first_name: "Mel", last_name: "Member" };
    const res = await POST(req({ surface: "member", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const sentTools = (create.mock.calls[0][0].tools as Array<{ name: string }>).map((t) => t.name);
    // Member tools never include any admin-only write tool.
    expect(sentTools).not.toContain("approve_account");
    expect(sentTools).not.toContain("issue_certification");
    // The admin service-role client was never constructed for a member.
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("a member requesting the admin surface STILL gets MEMBER tools (no privilege escalation)", async () => {
    authUser = { id: "user-1" };
    profileRow = { portal_role: "member" };
    const res = await POST(req({ surface: "admin", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const sentTools = (create.mock.calls[0][0].tools as Array<{ name: string }>).map((t) => t.name);
    expect(sentTools).not.toContain("approve_account");
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("an admin on the admin surface gets the ADMIN toolset", async () => {
    authUser = { id: "admin-1" };
    profileRow = { portal_role: "admin" };
    const res = await POST(req({ surface: "admin", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const sentTools = (create.mock.calls[0][0].tools as Array<{ name: string }>).map((t) => t.name);
    expect(sentTools).toContain("approve_account");
    expect(sentTools).toContain("issue_certification");
    // The admin write path uses the service-role client.
    expect(createSupabaseAdminClient).toHaveBeenCalled();
  });

  it("a superadmin on the admin surface also gets the ADMIN toolset", async () => {
    authUser = { id: "su-1" };
    profileRow = { portal_role: "superadmin" };
    const res = await POST(req({ surface: "admin", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const sentTools = (create.mock.calls[0][0].tools as Array<{ name: string }>).map((t) => t.name);
    expect(sentTools).toContain("approve_account");
  });

  it("an admin NOT on the admin surface gets MEMBER tools", async () => {
    authUser = { id: "admin-1" };
    profileRow = { portal_role: "admin" };
    const res = await POST(req({ surface: "member", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(200);
    const sentTools = (create.mock.calls[0][0].tools as Array<{ name: string }>).map((t) => t.name);
    expect(sentTools).not.toContain("approve_account");
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns 500 with a detail when the assistant loop throws", async () => {
    authUser = { id: "user-1" };
    profileRow = { portal_role: "member" };
    create.mockRejectedValue(new Error("upstream exploded"));
    const res = await POST(req({ surface: "member", messages: [{ role: "user", content: "hi" }] }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("assistant_error");
    expect(body.detail).toBe("upstream exploded");
  });
});
