import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockUser: { id: string } | null;
let mockProfileRow: { portal_role: string | null } | null;
let mockPayments: unknown[] | null;

function makeQuery() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(() =>
    Promise.resolve({ data: mockPayments, error: null }),
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
  from: vi.fn(() => makeQuery()),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => sb,
}));

import { GET } from "@/app/api/admin/export/payments/route";

beforeEach(() => {
  mockUser = { id: "admin-1" };
  mockProfileRow = { portal_role: "admin" };
  mockPayments = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/admin/export/payments — admin gating", () => {
  it("403 when there is no session", async () => {
    mockUser = null;
    expect((await GET()).status).toBe(403);
  });

  it("403 for a non-admin member", async () => {
    mockProfileRow = { portal_role: "member" };
    expect((await GET()).status).toBe(403);
  });

  it("403 when the profile row is missing", async () => {
    mockProfileRow = null;
    expect((await GET()).status).toBe(403);
  });

  it("200 text/csv attachment for an admin caller", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("payments");
  });
});

describe("GET /api/admin/export/payments — CSV shape & escaping", () => {
  it("emits the expected header row", async () => {
    const text = await (await GET()).text();
    expect(text.split("\n")[0]).toBe("Date,Product,Amount,Currency,Status,Slug");
  });

  it("renders one row per payment with cents converted to dollars", async () => {
    mockPayments = [
      {
        created_at: "2024-05-06T12:00:00Z",
        product_name: "Annual Dues",
        amount_cents: 12345,
        currency: "USD",
        status: "paid",
        slug: "annual-dues",
      },
    ];
    const lines = (await (await GET()).text()).split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("2024-05-06,Annual Dues,123.45,USD,paid,annual-dues");
  });

  it("leaves amount blank when amount_cents is null", async () => {
    mockPayments = [
      {
        created_at: "2024-05-06T12:00:00Z",
        product_name: "X",
        amount_cents: null,
        currency: "USD",
        status: "paid",
        slug: "x",
      },
    ];
    const row = (await (await GET()).text()).split("\n")[1];
    expect(row).toBe("2024-05-06,X,,USD,paid,x");
  });

  it("neutralizes a formula-injection product name", async () => {
    mockPayments = [
      {
        created_at: "2024-05-06T12:00:00Z",
        product_name: "=HYPERLINK(\"http://evil\")",
        amount_cents: 100,
        currency: "USD",
        status: "paid",
        slug: "@cmd",
      },
    ];
    const row = (await (await GET()).text()).split("\n")[1];
    // product_name contains no comma but starts with "=" -> prefixed with "'".
    expect(row).toContain(`'=HYPERLINK`);
    expect(row).toContain("'@cmd");
    expect(row).not.toMatch(/(^|,)=/);
    expect(row).not.toMatch(/(^|,)@/);
  });

  it("quotes a product name containing a comma", async () => {
    mockPayments = [
      {
        created_at: "2024-05-06T12:00:00Z",
        product_name: "Dues, Annual",
        amount_cents: 100,
        currency: "USD",
        status: "paid",
        slug: "x",
      },
    ];
    const text = await (await GET()).text();
    expect(text).toContain(`"Dues, Annual"`);
  });
});
