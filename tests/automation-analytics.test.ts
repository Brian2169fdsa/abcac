import { describe, it, expect } from "vitest";
import {
  computeWorkflowStats,
  computeImpact,
  computeDaily,
  computeAnomalies,
  computeTiers,
  analyzeRuns,
  type AnalyticsRunRow,
} from "@/lib/automation/analytics";
import { minutesSavedFor, workflowLabel, STAFF_HOURLY_RATE_USD } from "@/lib/automation/catalog";

function run(p: Partial<AnalyticsRunRow>): AnalyticsRunRow {
  // Use `in` checks so an explicitly-passed null (tier/created_at) is preserved
  // rather than coalesced back to the default.
  return {
    workflow: p.workflow ?? "dunning",
    status: p.status ?? "auto_executed",
    tier: "tier" in p ? (p.tier ?? null) : "auto",
    created_at: "created_at" in p ? (p.created_at ?? null) : "2026-06-10T12:00:00Z",
    anomaly_flags: "anomaly_flags" in p ? (p.anomaly_flags ?? null) : null,
    confidence: p.confidence ?? null,
  };
}

describe("computeWorkflowStats", () => {
  it("tallies statuses and derives rates + minutes saved", () => {
    const rows = [
      run({ workflow: "dunning", status: "auto_executed" }),
      run({ workflow: "dunning", status: "auto_executed" }),
      run({ workflow: "dunning", status: "escalated" }),
      run({ workflow: "dunning", status: "failed" }),
      run({ workflow: "ceu_review", status: "approved" }),
      run({ workflow: "ceu_review", status: "pending_approval" }),
    ];
    const stats = computeWorkflowStats(rows);
    const dunning = stats.find((s) => s.workflow === "dunning")!;
    expect(dunning.total).toBe(4);
    expect(dunning.autoExecuted).toBe(2);
    expect(dunning.automatedCount).toBe(2);
    expect(dunning.automationRate).toBeCloseTo(0.5);
    expect(dunning.escalationRate).toBeCloseTo(0.25);
    expect(dunning.failureRate).toBeCloseTo(0.25);
    expect(dunning.minutesSaved).toBe(2 * minutesSavedFor("dunning"));

    const ceu = stats.find((s) => s.workflow === "ceu_review")!;
    expect(ceu.approved).toBe(1);
    expect(ceu.pendingApproval).toBe(1);
    expect(ceu.automatedCount).toBe(1); // approved counts, pending does not
  });

  it("sorts by total volume descending and is empty-safe", () => {
    expect(computeWorkflowStats([])).toEqual([]);
    const rows = [run({ workflow: "a" }), run({ workflow: "b" }), run({ workflow: "b" })];
    expect(computeWorkflowStats(rows)[0].workflow).toBe("b");
  });
});

describe("computeImpact", () => {
  it("sums minutes/hours/cost only from automated runs", () => {
    const rows = [
      run({ workflow: "credential_verification", status: "auto_executed" }), // 8 min
      run({ workflow: "credential_verification", status: "escalated" }), // no credit
      run({ workflow: "dunning", status: "approved" }), // 4 min
    ];
    const impact = computeImpact(rows, "2026-06-01T00:00:00Z");
    expect(impact.totalRuns).toBe(3);
    expect(impact.automatedCount).toBe(2);
    expect(impact.minutesSaved).toBe(12);
    expect(impact.hoursSaved).toBeCloseTo(0.2);
    expect(impact.costSaved).toBeCloseTo((12 / 60) * STAFF_HOURLY_RATE_USD);
    expect(impact.automationRate).toBeCloseTo(2 / 3);
    // byWorkflow excludes zero-automation workflows, sorted by minutes desc
    expect(impact.byWorkflow.map((w) => w.workflow)).toEqual(["credential_verification", "dunning"]);
  });

  it("never divides by zero on an empty window", () => {
    const impact = computeImpact([], "2026-06-01T00:00:00Z");
    expect(impact.automationRate).toBe(0);
    expect(impact.minutesSaved).toBe(0);
    expect(impact.byWorkflow).toEqual([]);
  });
});

describe("computeDaily", () => {
  const now = new Date("2026-06-10T08:00:00Z");

  it("zero-fills a continuous trailing window anchored on today (UTC)", () => {
    const series = computeDaily([], 7, now);
    expect(series).toHaveLength(7);
    expect(series[0].date).toBe("2026-06-04");
    expect(series[6].date).toBe("2026-06-10");
    expect(series.every((p) => p.total === 0)).toBe(true);
  });

  it("buckets runs by UTC day and classifies them", () => {
    const rows = [
      run({ created_at: "2026-06-10T01:00:00Z", status: "auto_executed" }),
      run({ created_at: "2026-06-10T23:00:00Z", status: "escalated" }),
      run({ created_at: "2026-06-09T12:00:00Z", status: "failed" }),
      run({ created_at: "2026-05-01T12:00:00Z", status: "auto_executed" }), // outside window → dropped
      run({ created_at: null, status: "auto_executed" }), // no date → skipped
    ];
    const series = computeDaily(rows, 7, now);
    const today = series.find((p) => p.date === "2026-06-10")!;
    expect(today.total).toBe(2);
    expect(today.automated).toBe(1);
    expect(today.escalated).toBe(1);
    const yest = series.find((p) => p.date === "2026-06-09")!;
    expect(yest.failed).toBe(1);
    expect(series.reduce((n, p) => n + p.total, 0)).toBe(3); // out-of-window + null excluded
  });
});

describe("computeAnomalies + computeTiers", () => {
  it("counts and ranks anomaly flags, top N", () => {
    const rows = [
      run({ anomaly_flags: ["ambiguous_invoice_match", "approved_unpaid"] }),
      run({ anomaly_flags: ["approved_unpaid"] }),
      run({ anomaly_flags: null }),
      run({ anomaly_flags: [""] }), // empty flag ignored
    ];
    const anomalies = computeAnomalies(rows);
    expect(anomalies[0]).toEqual({ flag: "approved_unpaid", count: 2 });
    expect(anomalies.find((a) => a.flag === "")).toBeUndefined();
  });

  it("distributes tiers with an unknown bucket", () => {
    const rows = [run({ tier: "auto" }), run({ tier: "auto" }), run({ tier: "escalate" }), run({ tier: null })];
    const tiers = computeTiers(rows);
    expect(tiers[0]).toEqual({ tier: "auto", count: 2 });
    expect(tiers.find((t) => t.tier === "unknown")?.count).toBe(1);
  });
});

describe("analyzeRuns + catalog labels", () => {
  it("bundles every lens from one window", () => {
    const rows = [run({ workflow: "dunning", status: "auto_executed", created_at: "2026-06-10T01:00:00Z" })];
    const a = analyzeRuns(rows, { days: 30, since: "2026-05-11T00:00:00Z", now: new Date("2026-06-10T08:00:00Z") });
    expect(a.totalRuns).toBe(1);
    expect(a.daily).toHaveLength(30);
    expect(a.impact.minutesSaved).toBe(minutesSavedFor("dunning"));
    expect(a.workflowStats[0].workflow).toBe("dunning");
  });

  it("workflowLabel humanizes unknown workflows", () => {
    expect(workflowLabel("dunning")).toBe("Dunning");
    expect(workflowLabel("some_new_flow")).toBe("Some New Flow");
  });
});
