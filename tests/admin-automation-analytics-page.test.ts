import { describe, it, expect } from "vitest";
import {
  clampDays,
  coerceLens,
  shortDateLabel,
  lensSeries,
  ALLOWED_DAYS,
  DEFAULT_DAYS,
  LENSES,
  type DailyPoint,
} from "@/app/(admin)/admin/automation/analytics/analytics-dashboard";
import { workflowLabel, workflowMeta } from "@/lib/automation/catalog";
import { formatUsd, formatPercent, formatDuration } from "@/lib/format";

describe("clampDays", () => {
  it("passes through each allowed value", () => {
    for (const d of ALLOWED_DAYS) {
      expect(clampDays(d)).toBe(d);
      expect(clampDays(String(d))).toBe(d);
    }
  });

  it("clamps out-of-set, junk, and missing values to the default", () => {
    expect(clampDays(1)).toBe(DEFAULT_DAYS);
    expect(clampDays(45)).toBe(DEFAULT_DAYS);
    expect(clampDays("abc")).toBe(DEFAULT_DAYS);
    expect(clampDays(null)).toBe(DEFAULT_DAYS);
    expect(clampDays(undefined)).toBe(DEFAULT_DAYS);
  });

  it("uses the first element when given an array (repeated query param)", () => {
    expect(clampDays(["90", "7"])).toBe(90);
    expect(clampDays(["999"])).toBe(DEFAULT_DAYS);
  });
});

describe("catalog labels/categories (shared)", () => {
  it("maps known workflows to friendly labels", () => {
    expect(workflowLabel("ceu_review")).toBe("CEU Review");
    expect(workflowLabel("invoice_generation")).toBe("Invoice Generation");
  });

  it("title-cases an unknown slug as a fallback", () => {
    expect(workflowLabel("some_new_flow")).toBe("Some New Flow");
  });

  it("exposes a category per known workflow and undefined for unknowns", () => {
    expect(workflowMeta("ceu_review")?.category).toBe("deterministic");
    expect(workflowMeta("account_approval")?.category).toBe("agent");
    expect(workflowMeta("reciprocity")?.category).toBe("human_gate");
    expect(workflowMeta("mystery")).toBeUndefined();
  });
});

describe("shared formatters", () => {
  it("formatUsd renders whole-dollar currency and guards non-finite", () => {
    expect(formatUsd(1234)).toBe("$1,234");
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(Number.NaN)).toBe("$0");
  });

  it("formatPercent shows a fraction as a whole percent", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.073)).toBe("7%");
  });

  it("formatDuration renders minutes / hours+minutes", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(150)).toBe("2h 30m");
    expect(formatDuration(-5)).toBe("0m");
  });
});

describe("coerceLens", () => {
  it("accepts each valid lens and defaults the rest to Total", () => {
    for (const l of LENSES) expect(coerceLens(l)).toBe(l);
    expect(coerceLens("Bogus")).toBe("Total");
    expect(coerceLens(null)).toBe("Total");
    expect(coerceLens(undefined)).toBe("Total");
  });
});

describe("shortDateLabel", () => {
  it("formats an ISO date as a short month/day label (UTC-stable)", () => {
    expect(shortDateLabel("2026-06-04")).toBe("Jun 4");
    expect(shortDateLabel("2026-01-01")).toBe("Jan 1");
    expect(shortDateLabel("2026-12-31")).toBe("Dec 31");
  });

  it("returns the raw input for an unparseable date", () => {
    expect(shortDateLabel("not-a-date")).toBe("not-a-date");
  });
});

describe("lensSeries", () => {
  const daily: DailyPoint[] = [
    { date: "2026-06-03", total: 10, automated: 7, escalated: 2, failed: 1 },
    { date: "2026-06-04", total: 4, automated: 3, escalated: 1, failed: 0 },
  ];

  it("picks the field matching the chosen lens", () => {
    expect(lensSeries(daily, "Total").map((d) => d.value)).toEqual([10, 4]);
    expect(lensSeries(daily, "Automated").map((d) => d.value)).toEqual([7, 3]);
    expect(lensSeries(daily, "Escalated").map((d) => d.value)).toEqual([2, 1]);
    expect(lensSeries(daily, "Failed").map((d) => d.value)).toEqual([1, 0]);
  });

  it("labels each datum with the short date", () => {
    expect(lensSeries(daily, "Total").map((d) => d.label)).toEqual(["Jun 3", "Jun 4"]);
  });

  it("returns an empty array for an empty series", () => {
    expect(lensSeries([], "Total")).toEqual([]);
  });
});
