import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/server BEFORE importing the route. A single mutable client
// is returned by createSupabaseServerClient(). The query builder is chainable
// (.select/.or/.eq/.ilike/.gte/.lte/.order/.limit) and awaitable — resolving to
// the configured `mockRows`. The role lookup ends in .maybeSingle().
// ---------------------------------------------------------------------------
let mockUser: { id: string } | null;
let mockProfileRow: { portal_role: string | null } | null;
let mockRows: unknown[] | null;
const orSpy = vi.fn();

function makeQuery(table: string) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.or = vi.fn((arg: string) => {
    orSpy(arg);
    return builder;
  });
  builder.eq = vi.fn(chain);
  builder.ilike = vi.fn(chain);
  builder.gte = vi.fn(chain);
  builder.lte = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(() => Promise.resolve({ data: mockRows, error: null }));
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: table === "profiles" ? mockProfileRow : null, error: null }),
  );
  // Awaitable terminal in case the chain ends without .limit().
  builder.then = (onF: (v: unknown) => unknown) =>
    Promise.resolve({ data: mockRows, error: null }).then(onF);
  return builder;
}

const sb = {
  auth: { getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser } })) },
  from: vi.fn((table: string) => makeQuery(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => sb,
}));

import { GET } from "@/app/api/admin/automation/audit/export/route";
import {
  parseFilters,
  filtersToParams,
  isAutomationScoped,
  matchesJsFilters,
  rowOutcome,
  rowWorkflow,
  escapeCsv,
  serializeRow,
  buildCsv,
  CSV_HEADER,
  type AuditFilters,
} from "@/app/api/admin/automation/audit/audit-shared";

function makeReq(qs = "") {
  return new Request(`http://x/api/admin/automation/audit/export${qs}`);
}

beforeEach(() => {
  mockUser = { id: "admin-1" };
  mockProfileRow = { portal_role: "admin" };
  mockRows = [];
  orSpy.mockClear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── parseFilters: validation + clamping ────────────────────────────────────

describe("parseFilters", () => {
  it("returns all-null/page-1 for empty params", () => {
    const f = parseFilters({});
    expect(f).toEqual({
      workflow: null,
      actorType: null,
      decisionTier: null,
      outcome: null,
      from: null,
      to: null,
      action: null,
      page: 1,
    });
  });

  it("accepts valid enum values and dates", () => {
    const f = parseFilters({
      workflow: "dunning",
      actor_type: "system",
      decision_tier: "auto",
      outcome: "error",
      from: "2026-01-01",
      to: "2026-02-01",
      action: " mark_paid ",
    });
    expect(f.workflow).toBe("dunning");
    expect(f.actorType).toBe("system");
    expect(f.decisionTier).toBe("auto");
    expect(f.outcome).toBe("error");
    expect(f.from).toBe("2026-01-01");
    expect(f.to).toBe("2026-02-01");
    expect(f.action).toBe("mark_paid"); // trimmed
  });

  it("drops unknown enum values and malformed dates", () => {
    const f = parseFilters({
      workflow: "not_a_workflow",
      actor_type: "robot",
      decision_tier: "instant",
      outcome: "maybe",
      from: "01-01-2026",
      to: "garbage",
    });
    expect(f.workflow).toBeNull();
    expect(f.actorType).toBeNull();
    expect(f.decisionTier).toBeNull();
    expect(f.outcome).toBeNull();
    expect(f.from).toBeNull();
    expect(f.to).toBeNull();
  });

  it("clamps page to an integer >= 1", () => {
    expect(parseFilters({ page: "0" }).page).toBe(1);
    expect(parseFilters({ page: "-5" }).page).toBe(1);
    expect(parseFilters({ page: "abc" }).page).toBe(1);
    expect(parseFilters({ page: "3" }).page).toBe(3);
  });

  it("takes the first value when a param arrives as an array", () => {
    const f = parseFilters({ workflow: ["ceu_review", "dunning"] });
    expect(f.workflow).toBe("ceu_review");
  });
});

// ── filtersToParams: round-trip / omission ─────────────────────────────────

describe("filtersToParams", () => {
  const base: AuditFilters = {
    workflow: null,
    actorType: null,
    decisionTier: null,
    outcome: null,
    from: null,
    to: null,
    action: null,
    page: 1,
  };

  it("omits null/All filters and page=1", () => {
    expect(filtersToParams(base, { includePage: true })).toEqual({});
  });

  it("emits set filters with the URL param names", () => {
    const out = filtersToParams({
      ...base,
      workflow: "invoice_generation",
      actorType: "agent",
      decisionTier: "propose",
      outcome: "ok",
      from: "2026-01-01",
      to: "2026-01-31",
      action: "approve",
    });
    expect(out).toEqual({
      workflow: "invoice_generation",
      actor_type: "agent",
      decision_tier: "propose",
      outcome: "ok",
      from: "2026-01-01",
      to: "2026-01-31",
      action: "approve",
    });
  });

  it("includes page only when > 1 and requested", () => {
    expect(filtersToParams({ ...base, page: 4 }, { includePage: true }).page).toBe("4");
    expect(filtersToParams({ ...base, page: 4 }).page).toBeUndefined();
  });
});

// ── isAutomationScoped predicate ───────────────────────────────────────────

describe("isAutomationScoped", () => {
  it("true when tied to an automation run", () => {
    expect(isAutomationScoped({ automation_run_id: "run-1", actor_type: "human" })).toBe(true);
  });
  it("true for system/agent actors", () => {
    expect(isAutomationScoped({ actor_type: "system" })).toBe(true);
    expect(isAutomationScoped({ actor_type: "agent" })).toBe(true);
  });
  it("false for a human actor with no run", () => {
    expect(isAutomationScoped({ actor_type: "human", automation_run_id: null })).toBe(false);
  });
});

// ── JS workflow/outcome matching ───────────────────────────────────────────

describe("rowOutcome / rowWorkflow / matchesJsFilters", () => {
  it("derives outcome from details.ok and details.error", () => {
    expect(rowOutcome({ ok: true })).toBe("ok");
    expect(rowOutcome({ ok: false })).toBe("error");
    expect(rowOutcome({ error: "boom" })).toBe("error");
    expect(rowOutcome({})).toBeNull();
    expect(rowOutcome(null)).toBeNull();
  });

  it("reads the workflow key from details", () => {
    expect(rowWorkflow({ workflow: "dunning" })).toBe("dunning");
    expect(rowWorkflow({})).toBeNull();
  });

  it("matches workflow + outcome filters against details", () => {
    const row = { details: { workflow: "dunning", ok: false } };
    expect(matchesJsFilters(row, { workflow: "dunning", outcome: "error" })).toBe(true);
    expect(matchesJsFilters(row, { workflow: "ceu_review", outcome: null })).toBe(false);
    expect(matchesJsFilters(row, { workflow: null, outcome: "ok" })).toBe(false);
    expect(matchesJsFilters(row, { workflow: null, outcome: null })).toBe(true);
  });
});

// ── CSV escaping + serialization ───────────────────────────────────────────

describe("escapeCsv", () => {
  it("passes through plain values and renders null/undefined as empty", () => {
    expect(escapeCsv("hello")).toBe("hello");
    expect(escapeCsv(null)).toBe("");
    expect(escapeCsv(undefined)).toBe("");
  });

  it("quotes and doubles embedded quotes, commas, and newlines", () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes spreadsheet formula-injection prefixes", () => {
    expect(escapeCsv("=1+1")).toBe("'=1+1");
    expect(escapeCsv("+A1")).toBe("'+A1");
    expect(escapeCsv("-2")).toBe("'-2");
    expect(escapeCsv("@x")).toBe("'@x");
  });
});

describe("serializeRow / buildCsv", () => {
  it("serializes a row in CSV_HEADER order with derived fields", () => {
    const cells = serializeRow({
      created_at: "2026-06-01T10:00:00Z",
      actor_type: "system",
      admin_id: null,
      action: "auto:mark_invoice_paid",
      details: { workflow: "dunning", ok: true },
      decision_tier: "auto",
      target_table: "invoices",
      target_id: "inv-1",
      automation_run_id: "run-9",
      profiles: null,
    });
    expect(cells).toEqual([
      "2026-06-01T10:00:00Z",
      "system",
      "system", // admin_name falls back to actor_type when no profile
      "auto:mark_invoice_paid",
      "dunning",
      "auto",
      "true",
      "",
      "invoices",
      "inv-1",
      "run-9",
    ]);
  });

  it("uses the joined profile name for human-approved rows", () => {
    const cells = serializeRow({
      actor_type: "agent",
      admin_id: "u-1",
      details: { workflow: "ceu_review", ok: false, error: "nope" },
      profiles: { first_name: "Ada", last_name: "Lovelace", email: "ada@x.com" },
    });
    expect(cells[2]).toBe("Ada Lovelace");
    expect(cells[6]).toBe("false");
    expect(cells[7]).toBe("nope");
  });

  it("buildCsv emits the header row then one line per record", () => {
    const csv = buildCsv([
      { created_at: "2026-06-01T10:00:00Z", actor_type: "system", details: { ok: true } },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(CSV_HEADER.join(","));
    expect(lines).toHaveLength(2);
  });
});

// ── Route: admin gate + base automation filter ─────────────────────────────

describe("GET /api/admin/automation/audit/export — admin gating", () => {
  it("401 when there is no session", async () => {
    mockUser = null;
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("403 when the caller is a non-admin member", async () => {
    mockProfileRow = { portal_role: "member" };
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("403 when the profile row is missing", async () => {
    mockProfileRow = null;
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("200 text/csv attachment for an admin caller", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("automation-audit");
  });

  it("200 for a superadmin caller", async () => {
    mockProfileRow = { portal_role: "superadmin" };
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });

  it("applies the automation-scope base filter via .or()", async () => {
    await GET(makeReq());
    expect(orSpy).toHaveBeenCalledWith(
      "automation_run_id.not.is.null,actor_type.in.(system,agent)",
    );
  });

  it("re-applies the JS scope filter, dropping human/no-run rows", async () => {
    mockRows = [
      { id: "1", actor_type: "system", details: { workflow: "dunning", ok: true } },
      { id: "2", actor_type: "human", automation_run_id: null, details: { ok: true } },
    ];
    const res = await GET(makeReq());
    const lines = (await res.text()).split("\n");
    // header + exactly one in-scope row
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("system");
  });

  it("filters by workflow + outcome in JS from details", async () => {
    mockRows = [
      { id: "1", actor_type: "system", details: { workflow: "dunning", ok: false, error: "x" } },
      { id: "2", actor_type: "system", details: { workflow: "ceu_review", ok: true } },
    ];
    const res = await GET(makeReq("?workflow=dunning&outcome=error"));
    const lines = (await res.text()).split("\n");
    expect(lines).toHaveLength(2); // header + the one dunning/error row
    expect(lines[1]).toContain("dunning");
  });
});
