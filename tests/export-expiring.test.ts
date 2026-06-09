import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockUser: { id: string } | null;
let mockProfileRow: { portal_role: string | null } | null;
let mockCerts: unknown[] | null;

function makeQuery(table: string) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.gte = vi.fn(chain);
  builder.lte = vi.fn(chain);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: mockProfileRow, error: null }),
  );
  // The certifications listing terminates in .order(); profiles role-lookup
  // never reaches .order().
  builder.order = vi.fn(() =>
    Promise.resolve({ data: mockCerts, error: null }),
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

import { GET } from "@/app/api/admin/export/expiring/route";

beforeEach(() => {
  mockUser = { id: "admin-1" };
  mockProfileRow = { portal_role: "admin" };
  mockCerts = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/admin/export/expiring — admin gating", () => {
  it("403 with no session", async () => {
    mockUser = null;
    expect((await GET()).status).toBe(403);
  });

  it("403 for a non-admin member", async () => {
    mockProfileRow = { portal_role: "member" };
    expect((await GET()).status).toBe(403);
  });

  it("200 text/csv attachment for an admin", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("expiring");
  });
});

describe("GET /api/admin/export/expiring — CSV shape & escaping", () => {
  it("emits the expected header row", async () => {
    const text = await (await GET()).text();
    expect(text.split("\n")[0]).toBe("Member,Credential,Number,Expires");
  });

  it("joins a member name from an object-shaped profiles relation", async () => {
    mockCerts = [
      {
        cert_type: "CPR",
        cert_number: "ABC123",
        expiration_date: "2026-07-01",
        profiles: { first_name: "Ada", last_name: "Lovelace" },
      },
    ];
    const lines = (await (await GET()).text()).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("Ada Lovelace,CPR,ABC123,2026-07-01");
  });

  it("handles an array-shaped profiles relation", async () => {
    mockCerts = [
      {
        cert_type: "CPR",
        cert_number: "X1",
        expiration_date: "2026-07-01",
        profiles: [{ first_name: "Alan", last_name: "Turing" }],
      },
    ];
    const row = (await (await GET()).text()).split("\n")[1];
    expect(row).toBe("Alan Turing,CPR,X1,2026-07-01");
  });

  it("tolerates a null profiles relation (empty member name)", async () => {
    mockCerts = [
      {
        cert_type: "CPR",
        cert_number: "X1",
        expiration_date: "2026-07-01",
        profiles: null,
      },
    ];
    const row = (await (await GET()).text()).split("\n")[1];
    expect(row).toBe(",CPR,X1,2026-07-01");
  });

  it("neutralizes a formula-injection member name", async () => {
    mockCerts = [
      {
        cert_type: "=2+2",
        cert_number: "+1",
        expiration_date: "2026-07-01",
        profiles: { first_name: "@Bob", last_name: "Smith" },
      },
    ];
    const row = (await (await GET()).text()).split("\n")[1];
    expect(row).toContain("'@Bob Smith");
    expect(row).toContain("'=2+2");
    expect(row).toContain("'+1");
    expect(row).not.toMatch(/(^|,)[=+@]/);
  });
});
