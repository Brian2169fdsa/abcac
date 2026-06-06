import { describe, it, expect } from "vitest";
import {
  computeCompliance,
  REQUIRED_TOTAL,
  REQUIRED_ETHICS,
  REQUIRED_CULTURAL,
} from "@/lib/ceu-compliance";
import type { CeuLike } from "@/lib/ceu-compliance";

describe("computeCompliance", () => {
  it("empty array → totalApproved 0, remaining 40, compliant false, percent 0", () => {
    const result = computeCompliance([]);
    expect(result.totalApproved).toBe(0);
    expect(result.remaining).toBe(REQUIRED_TOTAL);
    expect(result.compliant).toBe(false);
    expect(result.percent).toBe(0);
  });

  it("only 'approved' records are counted — a pending record does not contribute", () => {
    const records: CeuLike[] = [
      { hours: 100, category: "General", status: "pending" },
    ];
    const result = computeCompliance(records);
    expect(result.totalApproved).toBe(0);
    expect(result.remaining).toBe(REQUIRED_TOTAL);
    expect(result.compliant).toBe(false);
  });

  it("fully compliant: 40 total including 3 Ethics + 3 Cultural", () => {
    const records: CeuLike[] = [
      { hours: 3, category: "Ethics", status: "approved" },
      { hours: 3, category: "Cultural Diversity", status: "approved" },
      { hours: 34, category: "General", status: "approved" },
    ];
    const result = computeCompliance(records);
    expect(result.compliant).toBe(true);
    expect(result.remaining).toBe(0);
    expect(result.ethicsRemaining).toBe(0);
    expect(result.culturalRemaining).toBe(0);
    expect(result.percent).toBe(100);
  });

  it("behind on total but enough ethics/cultural → compliant false, remaining > 0", () => {
    const records: CeuLike[] = [
      { hours: 3, category: "Ethics", status: "approved" },
      { hours: 3, category: "Cultural Diversity", status: "approved" },
      { hours: 10, category: "General", status: "approved" },
    ];
    const result = computeCompliance(records);
    expect(result.compliant).toBe(false);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.ethicsRemaining).toBe(0);
    expect(result.culturalRemaining).toBe(0);
  });

  it("enough total hours but missing Ethics → compliant false, ethicsRemaining > 0", () => {
    const records: CeuLike[] = [
      { hours: 0, category: "Ethics", status: "approved" },
      { hours: 3, category: "Cultural Diversity", status: "approved" },
      { hours: 40, category: "General", status: "approved" },
    ];
    const result = computeCompliance(records);
    expect(result.compliant).toBe(false);
    expect(result.ethicsRemaining).toBeGreaterThan(0);
  });

  it("percent caps at 100 when total hours exceed 40", () => {
    const records: CeuLike[] = [
      { hours: 3, category: "Ethics", status: "approved" },
      { hours: 3, category: "Cultural Diversity", status: "approved" },
      { hours: 60, category: "General", status: "approved" },
    ];
    const result = computeCompliance(records);
    expect(result.percent).toBe(100);
    expect(result.totalApproved).toBeGreaterThan(REQUIRED_TOTAL);
  });

  it("null hours are treated as 0", () => {
    const records: CeuLike[] = [
      { hours: null, category: "Ethics", status: "approved" },
      { hours: null, category: "Cultural Diversity", status: "approved" },
    ];
    const result = computeCompliance(records);
    expect(result.totalApproved).toBe(0);
    expect(result.ethics).toBe(0);
    expect(result.cultural).toBe(0);
    expect(result.compliant).toBe(false);
  });
});
