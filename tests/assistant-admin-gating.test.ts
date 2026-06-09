import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the per-write admin re-check in src/lib/assistant/admin-tools.ts.
 *
 * Every WRITE executor (approve_account, reject_account, approve_ceu, …) calls
 * assertAdmin() first: it re-reads auth.getUser() + the caller's profile on the
 * RLS-scoped cookie client and throws "Forbidden — admin role required." unless
 * portal_role is admin/superadmin. This guards against a privilege change
 * mid-conversation even though the route already gated read access.
 *
 * We supply fake `sb` (cookie) and `admin` (service-role) clients directly to
 * getAdminExecutors — no network. @/lib/supabase/server is mocked only to keep
 * the transitive import (decideVerification) inert.
 */

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({}),
  createSupabaseAdminClient: () => ({}),
}));

import { getAdminExecutors } from "@/lib/assistant/admin-tools";

interface FakeOpts {
  /** The user returned by sb.auth.getUser(); null = not signed in. */
  user: { id: string } | null;
  /** portal_role returned by the profiles lookup. */
  role: string | null;
}

/** A chainable fake Supabase client whose terminal calls resolve to {data,error}. */
function makeSb(opts: FakeOpts) {
  // Records every write so we can assert a forbidden caller never wrote.
  const writes: Array<{ table: string; op: string }> = [];

  const client = {
    writes,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: opts.user } }),
    },
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: vi.fn(self),
        eq: vi.fn(self),
        in: vi.fn(self),
        not: vi.fn(self),
        gte: vi.fn(self),
        lte: vi.fn(self),
        order: vi.fn(self),
        or: vi.fn(self),
        limit: vi.fn(self),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { portal_role: opts.role }, error: null }),
        update: vi.fn((..._a: unknown[]) => {
          writes.push({ table, op: "update" });
          return chain;
        }),
        insert: vi.fn((..._a: unknown[]) => {
          writes.push({ table, op: "insert" });
          return Promise.resolve({ data: null, error: null });
        }),
      });
      return chain;
    }),
  };
  return client;
}

function makeAdminClient() {
  // Service-role client. Query builders are both chainable AND awaitable: each
  // method returns a thenable chain that resolves to {data,error}, so single or
  // multi-.eq() update chains and plain inserts all work.
  return {
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        update: vi.fn(self),
        eq: vi.fn(self),
        insert: vi.fn(self),
        // Makes the chain awaitable wherever a terminal call is awaited.
        then: (resolve: (v: { data: null; error: null }) => unknown) =>
          resolve({ data: null, error: null }),
      });
      return chain;
    }),
  };
}

function executorsFor(opts: FakeOpts) {
  const sb = makeSb(opts);
  const admin = makeAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exec = getAdminExecutors({ sb: sb as any, admin: admin as any, uid: "admin-uid" });
  return { exec, sb, admin };
}

// The write tools that must be admin-gated.
const WRITE_TOOLS = [
  "approve_account",
  "reject_account",
  "approve_ceu",
  "reject_ceu",
  "issue_certification",
  "send_message_to_member",
  "create_invoice",
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin write executors — per-write role re-check", () => {
  it.each(WRITE_TOOLS)("%s throws Forbidden when session role is member", async (tool) => {
    const { exec, sb } = executorsFor({ user: { id: "u1" }, role: "member" });
    await expect(exec[tool]({})).rejects.toThrow(/Forbidden/);
    // No write ever reached the service-role client / cookie client.
    expect(sb.writes).toHaveLength(0);
  });

  it.each(WRITE_TOOLS)("%s throws when there is no session", async (tool) => {
    const { exec } = executorsFor({ user: null, role: null });
    await expect(exec[tool]({})).rejects.toThrow(/Not signed in/);
  });

  it("a missing profile (null role) is treated as non-admin and forbidden", async () => {
    const { exec } = executorsFor({ user: { id: "u1" }, role: null });
    await expect(exec.approve_account({ member_id: "m1" })).rejects.toThrow(/Forbidden/);
  });

  it("approve_account proceeds past the gate for an admin role", async () => {
    const { exec, admin } = executorsFor({ user: { id: "a1" }, role: "admin" });
    const out = await exec.approve_account({ member_id: "m1" });
    expect(out).toMatch(/approved/i);
    // It reached the service-role client to perform the update.
    expect(admin.from).toHaveBeenCalledWith("profiles");
  });

  it("approve_account proceeds for a superadmin role", async () => {
    const { exec } = executorsFor({ user: { id: "s1" }, role: "superadmin" });
    const out = await exec.approve_account({ member_id: "m1" });
    expect(out).toMatch(/approved/i);
  });

  it("an admin-gated write still validates its own arguments after the gate", async () => {
    const { exec } = executorsFor({ user: { id: "a1" }, role: "admin" });
    // Passes the admin gate but missing member_id → argument error, not Forbidden.
    await expect(exec.approve_account({})).rejects.toThrow(/member_id is required/);
  });
});

describe("admin read executors — no role re-check required", () => {
  it("find_member validates input without an admin re-check", async () => {
    const { exec, sb } = executorsFor({ user: { id: "a1" }, role: "admin" });
    await expect(exec.find_member({ query: "" })).rejects.toThrow(/query is required/);
    // find_member never calls auth.getUser (no per-write re-check on reads).
    expect(sb.auth.getUser).not.toHaveBeenCalled();
  });
});
