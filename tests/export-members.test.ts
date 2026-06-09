import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Mock @/lib/supabase/server ----
// A single mutable client object is returned by createSupabaseServerClient().
// Tests reconfigure `mockUser` (the auth session) and the per-table query
// results before invoking the route.
let mockUser: { id: string } | null;
let mockProfileRow: { portal_role: string | null } | null;
let mockMembers: unknown[] | null;

function makeQuery(table: string) {
  // profiles role-lookup ends in .maybeSingle(); the bulk list ends in .order()
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(() =>
    Promise.resolve({ data: mockMembers, error: null }),
  );
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: mockProfileRow, error: null }),
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

import { GET } from "@/app/api/admin/export/members/route";

beforeEach(() => {
  mockUser = { id: "admin-1" };
  mockProfileRow = { portal_role: "admin" };
  mockMembers = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/admin/export/members — admin gating", () => {
  it("403 when there is no session", async () => {
    mockUser = null;
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("403 when the caller is a non-admin member", async () => {
    mockProfileRow = { portal_role: "member" };
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("403 when the profile row is missing", async () => {
    mockProfileRow = null;
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("200 text/csv attachment for an admin caller", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("members");
  });

  it("200 for a superadmin caller", async () => {
    mockProfileRow = { portal_role: "superadmin" };
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/admin/export/members — CSV shape & escaping", () => {
  it("emits the expected header row", async () => {
    const res = await GET();
    const text = await res.text();
    const firstLine = text.split("\n")[0];
    expect(firstLine).toBe(
      "First Name,Last Name,Email,Phone,Cert Status,Account Status,Role,Joined",
    );
  });

  it("emits one row per member record (header + N)", async () => {
    mockMembers = [
      {
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
        phone: "555-1",
        cert_status: "active",
        account_status: "active",
        portal_role: "member",
        created_at: "2024-01-02T10:00:00Z",
      },
      {
        first_name: "Alan",
        last_name: "Turing",
        email: "alan@example.com",
        phone: "555-2",
        cert_status: "active",
        account_status: "active",
        portal_role: "member",
        created_at: "2024-03-04T10:00:00Z",
      },
    ];
    const res = await GET();
    const lines = (await res.text()).split("\n");
    expect(lines).toHaveLength(3); // header + 2
    expect(lines[1]).toBe(
      "Ada,Lovelace,ada@example.com,555-1,active,active,member,2024-01-02",
    );
  });

  it("neutralizes formula-injection prefixes (= + - @) in fields", async () => {
    mockMembers = [
      {
        first_name: "=cmd|'/c calc'!A1",
        last_name: "+SUM(A1)",
        email: "-2+3",
        phone: "@evil",
        cert_status: "ok",
        account_status: "ok",
        portal_role: "member",
        created_at: "2024-01-02T00:00:00Z",
      },
    ];
    const res = await GET();
    const row = (await res.text()).split("\n")[1];
    // Each dangerous leading char gets a "'" prefix so spreadsheets treat it as text.
    expect(row).toContain("'=cmd|'/c calc'!A1");
    expect(row).toContain("'+SUM(A1)");
    expect(row).toContain("'-2+3");
    expect(row).toContain("'@evil");
    // No raw formula leak: no cell actually begins with "=" after a delimiter.
    expect(row).not.toMatch(/(^|,)=/);
  });

  it("quotes and escapes fields containing commas, quotes, and newlines", async () => {
    mockMembers = [
      {
        first_name: 'Smith, "Bob"',
        last_name: "line1\nline2",
        email: "ok@example.com",
        phone: "",
        cert_status: "",
        account_status: "",
        portal_role: "",
        created_at: "2024-01-02T00:00:00Z",
      },
    ];
    const res = await GET();
    const text = await res.text();
    // Embedded quotes doubled, whole field wrapped in quotes.
    expect(text).toContain(`"Smith, ""Bob"""`);
    expect(text).toContain(`"line1\nline2"`);
  });

  it("renders null fields as empty cells", async () => {
    mockMembers = [
      {
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
        cert_status: null,
        account_status: null,
        portal_role: null,
        created_at: null,
      },
    ];
    const res = await GET();
    const row = (await res.text()).split("\n")[1];
    expect(row).toBe(",,,,,,,");
  });
});
