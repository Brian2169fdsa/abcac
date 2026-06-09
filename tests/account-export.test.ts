import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockUser: { id: string } | null;
// Per-table canned data, keyed by table name.
let tableData: Record<string, unknown>;
// Records the (column,value) used in every .eq() so we can assert own-data scoping.
let eqCalls: Array<{ table: string; column: string; value: unknown }>;

function makeQuery(table: string) {
  const builder: Record<string, unknown> = {
    // Each terminal shape (.maybeSingle() for profile, awaited list for the
    // rest) resolves to this table's canned data.
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      resolve({ data: tableData[table] ?? null, error: null }),
  };
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push({ table, column, value });
    return builder;
  });
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: tableData[table] ?? null, error: null }),
  );
  return builder;
}

const sb = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser } })),
  },
  from: vi.fn((table: string) => makeQuery(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => sb,
}));

import { GET } from "@/app/api/account/export/route";

beforeEach(() => {
  mockUser = { id: "user-42" };
  tableData = {
    profiles: { id: "user-42", email: "me@example.com" },
    certifications: [{ id: "c1", member_id: "user-42" }],
    ceu_records: [{ id: "r1" }],
    documents: [],
    applications: [],
    payments: [{ id: "p1" }],
    invoices: [],
  };
  eqCalls = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/account/export — auth gating", () => {
  it("401 when there is no session", async () => {
    mockUser = null;
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("200 application/json attachment for a signed-in member", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("my-data");
  });
});

describe("GET /api/account/export — own data only", () => {
  it("scopes every table query to the signed-in user's id", async () => {
    await GET();
    // profiles is filtered by id; everything else by member_id — all on user-42.
    expect(eqCalls.length).toBeGreaterThan(0);
    for (const call of eqCalls) {
      expect(call.value).toBe("user-42");
    }
    const profileFilter = eqCalls.find((c) => c.table === "profiles");
    expect(profileFilter?.column).toBe("id");
    expect(
      eqCalls.filter((c) => c.table !== "profiles").every((c) => c.column === "member_id"),
    ).toBe(true);
  });

  it("returns the member's own rows in the payload", async () => {
    const res = await GET();
    const body = JSON.parse(await res.text());
    expect(body.profile).toEqual({ id: "user-42", email: "me@example.com" });
    expect(body.certifications).toEqual([{ id: "c1", member_id: "user-42" }]);
    expect(body.payments).toEqual([{ id: "p1" }]);
    expect(body.exported_at).toBeTypeOf("string");
  });

  it("defaults null query results to [] / null in the payload", async () => {
    tableData = {}; // every query returns null
    const res = await GET();
    const body = JSON.parse(await res.text());
    expect(body.profile).toBeNull();
    expect(body.certifications).toEqual([]);
    expect(body.invoices).toEqual([]);
  });
});
