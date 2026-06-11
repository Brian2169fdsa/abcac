import { describe, it, expect } from "vitest";
import {
  groupByCategory,
  clampDays,
  buildEnabledMap,
  isZeroAutomationByDesign,
  automationNote,
  mapRecentRun,
  CATEGORY_ORDER,
  DAYS_OPTIONS,
  type ConfigRow,
  type RawRunRow,
} from "@/app/(admin)/admin/automation/workflows/workflow-bits";
import { WORKFLOW_CATALOG, type WorkflowCategory } from "@/lib/automation/catalog";

describe("groupByCategory", () => {
  it("groups the full catalog in the fixed display order", () => {
    const groups = groupByCategory(WORKFLOW_CATALOG);
    // Every workflow lands in exactly one group.
    const total = groups.reduce((n, g) => n + g.workflows.length, 0);
    expect(total).toBe(WORKFLOW_CATALOG.length);
    // Order follows CATEGORY_ORDER, skipping empty categories.
    const present = CATEGORY_ORDER.filter((c) =>
      WORKFLOW_CATALOG.some((m) => m.category === c),
    );
    expect(groups.map((g) => g.category)).toEqual(present);
  });

  it("preserves catalog order within a group and omits empty categories", () => {
    const small = [
      { workflow: "b", label: "B", category: "agent" as WorkflowCategory, blurb: "" },
      { workflow: "a", label: "A", category: "deterministic" as WorkflowCategory, blurb: "" },
      { workflow: "c", label: "C", category: "agent" as WorkflowCategory, blurb: "" },
    ];
    const groups = groupByCategory(small);
    expect(groups.map((g) => g.category)).toEqual(["deterministic", "agent"]);
    const agent = groups.find((g) => g.category === "agent")!;
    expect(agent.workflows.map((w) => w.workflow)).toEqual(["b", "c"]);
  });
});

describe("clampDays", () => {
  it("accepts the allowed range values", () => {
    for (const d of DAYS_OPTIONS) {
      expect(clampDays(String(d))).toBe(d);
    }
  });

  it("falls back to 30 for invalid, missing, or out-of-set values", () => {
    expect(clampDays(undefined)).toBe(30);
    expect(clampDays("nonsense")).toBe(30);
    expect(clampDays("14")).toBe(30);
    expect(clampDays("-7")).toBe(30);
  });

  it("uses the first entry of an array param and honors a custom fallback", () => {
    expect(clampDays(["7", "90"])).toBe(7);
    expect(clampDays("bad", 90)).toBe(90);
  });
});

describe("buildEnabledMap", () => {
  it("maps workflow → enabled and coerces truthiness", () => {
    const rows: ConfigRow[] = [
      { workflow: "dunning", enabled: true },
      { workflow: "reciprocity", enabled: false },
    ];
    const map = buildEnabledMap(rows);
    expect(map.get("dunning")).toBe(true);
    expect(map.get("reciprocity")).toBe(false);
    expect(map.get("missing")).toBeUndefined();
  });

  it("tolerates null/empty input", () => {
    expect(buildEnabledMap(null).size).toBe(0);
    expect(buildEnabledMap(undefined).size).toBe(0);
    expect(buildEnabledMap([]).size).toBe(0);
  });
});

describe("zero-automation-by-design copy", () => {
  it("flags human_gate and observational, not deterministic/agent", () => {
    expect(isZeroAutomationByDesign("human_gate")).toBe(true);
    expect(isZeroAutomationByDesign("observational")).toBe(true);
    expect(isZeroAutomationByDesign("deterministic")).toBe(false);
    expect(isZeroAutomationByDesign("agent")).toBe(false);
  });

  it("returns explanatory note only for the by-design categories", () => {
    expect(automationNote("human_gate")).toMatch(/human gate/i);
    expect(automationNote("observational")).toMatch(/mirrors/i);
    expect(automationNote("deterministic")).toBeNull();
    expect(automationNote("agent")).toBeNull();
  });
});

describe("mapRecentRun", () => {
  it("maps a raw run row to the table shape with a run-detail href", () => {
    const raw: RawRunRow = {
      id: "run-123",
      created_at: "2026-06-10T12:00:00Z",
      status: "auto_executed",
      tier: "auto",
      summary: "Reminded member about unpaid invoice",
      member_id: "mem-9",
    };
    const row = mapRecentRun(raw);
    expect(row.id).toBe("run-123");
    expect(row.href).toBe("/admin/automation/runs/run-123");
    expect(row.status).toBe("auto_executed");
    expect(row.memberId).toBe("mem-9");
    expect(row.summary).toBe("Reminded member about unpaid invoice");
    expect(row.when).not.toBe("—");
  });

  it("falls back to an em dash for blank/whitespace summary and null timestamp", () => {
    const row = mapRecentRun({
      id: "run-x",
      created_at: null,
      status: "escalated",
      tier: null,
      summary: "   ",
      member_id: null,
    });
    expect(row.summary).toBe("—");
    expect(row.when).toBe("—");
    expect(row.memberId).toBeNull();
    expect(row.tier).toBeNull();
  });
});
