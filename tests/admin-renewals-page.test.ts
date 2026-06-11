import { describe, it, expect } from "vitest";
import {
  parseStageFilter,
  rowsForStage,
  urgencyColorClass,
  relativeDays,
  stageTabs,
  ACTIONABLE_STAGES,
} from "@/app/(admin)/admin/renewals/helpers";
import {
  buildRenewalPipeline,
  type CertInput,
  type InvoiceInput,
  type ProfileInput,
} from "@/lib/renewals";

// ── parseStageFilter ───────────────────────────────────────────────────────────

describe("parseStageFilter", () => {
  it("defaults to 'all' when absent", () => {
    expect(parseStageFilter(undefined)).toBe("all");
  });

  it("accepts each actionable stage", () => {
    for (const s of ACTIONABLE_STAGES) {
      expect(parseStageFilter(s)).toBe(s);
    }
  });

  it("clamps unknown / non-actionable values to 'all'", () => {
    expect(parseStageFilter("current")).toBe("all");
    expect(parseStageFilter("bogus")).toBe("all");
    expect(parseStageFilter("")).toBe("all");
  });

  it("reads the first element of an array param", () => {
    expect(parseStageFilter(["lapsed", "upcoming"])).toBe("lapsed");
    expect(parseStageFilter(["nope"])).toBe("all");
  });
});

// ── urgencyColorClass ──────────────────────────────────────────────────────────

describe("urgencyColorClass", () => {
  it("is muted when the days are unknown", () => {
    expect(urgencyColorClass(null)).toBe("text-muted");
  });

  it("is red (accent) for lapsed and <=14 days", () => {
    expect(urgencyColorClass(-1)).toBe("text-accent");
    expect(urgencyColorClass(0)).toBe("text-accent");
    expect(urgencyColorClass(14)).toBe("text-accent");
  });

  it("is amber between 15 and 45 days", () => {
    expect(urgencyColorClass(15)).toBe("text-[#C8741F]");
    expect(urgencyColorClass(45)).toBe("text-[#C8741F]");
  });

  it("is muted beyond 45 days", () => {
    expect(urgencyColorClass(46)).toBe("text-muted");
    expect(urgencyColorClass(120)).toBe("text-muted");
  });
});

// ── relativeDays ───────────────────────────────────────────────────────────────

describe("relativeDays", () => {
  it("handles unknown, today, future, and past with singular/plural", () => {
    expect(relativeDays(null)).toBe("no date");
    expect(relativeDays(0)).toBe("today");
    expect(relativeDays(1)).toBe("in 1 day");
    expect(relativeDays(30)).toBe("in 30 days");
    expect(relativeDays(-1)).toBe("1 day ago");
    expect(relativeDays(-7)).toBe("7 days ago");
  });
});

// ── pipeline-backed selectors (rowsForStage / stageTabs) ───────────────────────

const NOW = new Date("2026-06-11T00:00:00Z");

function iso(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString();
}

const profiles: ProfileInput[] = [
  { id: "m1", first_name: "Ana", last_name: "Lee", email: "ana@x.io" },
  { id: "m2", first_name: "Ben", last_name: "Ng", email: "ben@x.io" },
  { id: "m3", first_name: "Cy", last_name: "Ro", email: "cy@x.io" },
];

const certs: CertInput[] = [
  // m1: active, expiring in 10 days, no renewal invoice → upcoming
  { member_id: "m1", cert_type: "RBT", cert_number: "A1", status: "active", expiration_date: iso(10) },
  // m2: active, expiring in 30 days, unpaid renewal invoice → invoiced
  { member_id: "m2", cert_type: "BCBA", cert_number: "B2", status: "active", expiration_date: iso(30) },
  // m3: expired → lapsed
  { member_id: "m3", cert_type: "RBT", cert_number: "C3", status: "expired", expiration_date: iso(-5) },
];

const invoices: InvoiceInput[] = [
  {
    member_id: "m2",
    invoice_number: "INV-2",
    description: "Annual renewal fee",
    amount_cents: 12_000,
    status: "unpaid",
    created_at: iso(-1),
  },
];

describe("rowsForStage", () => {
  const pipeline = buildRenewalPipeline(certs, invoices, profiles, NOW);

  it("returns all actionable rows for 'all', preserving lib ordering", () => {
    const rows = rowsForStage(pipeline, "all");
    expect(rows).toBe(pipeline.rows);
    expect(rows.map((r) => r.memberId)).toEqual(["m3", "m1", "m2"]); // lapsed, upcoming, invoiced
  });

  it("returns only the rows for a selected stage", () => {
    expect(rowsForStage(pipeline, "lapsed").map((r) => r.memberId)).toEqual(["m3"]);
    expect(rowsForStage(pipeline, "upcoming").map((r) => r.memberId)).toEqual(["m1"]);
    expect(rowsForStage(pipeline, "invoiced").map((r) => r.memberId)).toEqual(["m2"]);
  });

  it("returns an empty array for a stage with no rows", () => {
    expect(rowsForStage(pipeline, "renewed")).toEqual([]);
  });
});

describe("stageTabs", () => {
  const pipeline = buildRenewalPipeline(certs, invoices, profiles, NOW);

  it("leads with an 'All' tab counting every actionable row", () => {
    const tabs = stageTabs(pipeline);
    expect(tabs[0]).toEqual({ key: "all", label: "All", count: 3 });
  });

  it("lists every actionable stage with its count and label", () => {
    const tabs = stageTabs(pipeline);
    const keys = tabs.map((t) => t.key);
    expect(keys).toEqual(["all", ...ACTIONABLE_STAGES]);
    const byKey = Object.fromEntries(tabs.map((t) => [t.key, t.count]));
    expect(byKey.lapsed).toBe(1);
    expect(byKey.upcoming).toBe(1);
    expect(byKey.invoiced).toBe(1);
    expect(byKey.paid_processing).toBe(0);
    expect(byKey.renewed).toBe(0);
  });
});
