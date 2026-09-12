import { describe, it, expect } from "vitest";
import { buildCertSyncPlan, monthsBetween, SYNC_FEE_CENTS_PER_MONTH } from "@/lib/cert-sync";

describe("monthsBetween", () => {
  it("counts whole calendar months forward", () => {
    expect(monthsBetween("2026-01-15", "2026-04-15")).toBe(3);
  });
  it("does not round up a partial month", () => {
    expect(monthsBetween("2026-01-31", "2026-02-28")).toBe(0);
  });
  it("rounds a same-day-next-month correctly", () => {
    expect(monthsBetween("2026-01-15", "2026-02-15")).toBe(1);
  });
  it("never goes negative", () => {
    expect(monthsBetween("2026-06-01", "2026-01-01")).toBe(0);
  });
});

describe("buildCertSyncPlan", () => {
  const cac = { id: "c1", cert_type: "CAC", cert_number: "1001", expiration_date: "2026-06-01", status: "active" };
  const cadac = { id: "c2", cert_type: "CADAC", cert_number: "2002", expiration_date: "2026-12-01", status: "active" };

  it("requires at least two eligible certifications", () => {
    const result = buildCertSyncPlan([cac]);
    expect(result.ok).toBe(false);
  });

  it("ignores non-active or undated certifications", () => {
    const expired = { id: "c3", cert_type: "CCS", cert_number: "3", expiration_date: "2020-01-01", status: "expired" };
    const undated = { id: "c4", cert_type: "CPS", cert_number: "4", expiration_date: null, status: "active" };
    const result = buildCertSyncPlan([cac, cadac, expired, undated]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.items).toHaveLength(2);
  });

  it("targets the latest expiration and moves the earlier one forward", () => {
    const result = buildCertSyncPlan([cac, cadac]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.targetExpiration).toBe("2026-12-01");
    const cacItem = result.plan.items.find((i) => i.id === "c1")!;
    const cadacItem = result.plan.items.find((i) => i.id === "c2")!;
    expect(cacItem.monthsForward).toBe(6);
    expect(cadacItem.monthsForward).toBe(0);
    expect(result.plan.totalMonths).toBe(6);
    expect(result.plan.totalFeeCents).toBe(6 * SYNC_FEE_CENTS_PER_MONTH);
  });

  it("sums the shift across three or more certifications", () => {
    const ccjp = { id: "c5", cert_type: "CCJP", cert_number: "5", expiration_date: "2026-03-01", status: "active" };
    const result = buildCertSyncPlan([cac, cadac, ccjp]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.targetExpiration).toBe("2026-12-01");
    // cac: 6 months, ccjp: 9 months, cadac: 0
    expect(result.plan.totalMonths).toBe(15);
    expect(result.plan.totalFeeCents).toBe(15 * SYNC_FEE_CENTS_PER_MONTH);
  });

  it("rejects a set that already shares one expiration date", () => {
    const same1 = { id: "c6", cert_type: "CAC", cert_number: "6", expiration_date: "2026-05-01", status: "active" };
    const same2 = { id: "c7", cert_type: "CADAC", cert_number: "7", expiration_date: "2026-05-01", status: "active" };
    const result = buildCertSyncPlan([same1, same2]);
    expect(result.ok).toBe(false);
  });
});
