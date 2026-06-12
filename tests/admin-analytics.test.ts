import { describe, it, expect } from "vitest";
import {
  computeKpis,
  computeTrends,
  computeCertsByType,
  type NeedsAttention,
} from "@/lib/admin-analytics";

const NOW = new Date("2026-06-15T00:00:00Z");
const NA: NeedsAttention = {
  pendingApprovals: 2, pendingCeus: 3, openDocRequests: 1, pendingApplications: 4,
  openRequests: 2, escalations: 1, expiringSoon: 5, total: 18,
};

describe("computeKpis", () => {
  const certs = [
    { member_id: "m1", cert_type: "CAC", status: "active", issued_date: "2026-02-01" },
    { member_id: "m1", cert_type: "CADC", status: "active", issued_date: "2026-03-01" }, // same member, 2nd active
    { member_id: "m2", cert_type: "CAC", status: "active", issued_date: "2025-12-01" }, // prior year issue
    { member_id: "m3", cert_type: "CCS", status: "expired", issued_date: "2026-01-10" },
  ];
  const invoices = [
    { amount_cents: 15000, status: "paid", paid_at: "2026-06-05", created_at: "2026-06-01" }, // MTD + YTD
    { amount_cents: 5000, status: "paid", paid_at: "2026-02-05", created_at: "2026-02-01" }, // YTD only
    { amount_cents: 9999, status: "unpaid", created_at: "2026-06-02" }, // ignored
  ];
  const payments = [{ amount_cents: 2500, status: "paid", created_at: "2026-06-10" }];
  const profiles = [{ id: "m1" }, { id: "m2" }, { id: "m3" }, { id: "m4" }];

  it("computes YTD certs, distinct types, members, good standing, and revenue windows", () => {
    const k = computeKpis({ certs, invoices, payments, profiles, needsAttention: NA, now: NOW });
    expect(k.certsYtd).toBe(3); // 2026-issued: CAC, CADC, CCS(expired still counts as issued)
    expect(k.certTypeCount).toBe(3); // CAC, CADC, CCS
    expect(k.totalMembers).toBe(4);
    expect(k.goodStanding).toBe(2); // m1, m2 hold active certs (m1 deduped)
    expect(k.revenueMtdCents).toBe(15000 + 2500); // June paid invoice + payment
    expect(k.revenueYtdCents).toBe(15000 + 5000 + 2500);
    expect(k.openItems).toBe(18);
  });
});

describe("computeTrends", () => {
  it("builds a zero-filled monthly series ending on the current month", () => {
    const t = computeTrends({ certs: [], invoices: [], payments: [], profiles: [], ceus: [] }, 12, NOW);
    expect(t).toHaveLength(12);
    expect(t[11].month).toBe("2026-06");
    expect(t[11].label).toBe("Jun");
    expect(t[0].month).toBe("2025-07");
    expect(t.every((p) => p.revenueCents === 0)).toBe(true);
  });

  it("buckets revenue/certs/members/ceus by month", () => {
    const t = computeTrends(
      {
        certs: [{ issued_date: "2026-06-02" }, { issued_date: "2026-05-20" }],
        invoices: [{ amount_cents: 10000, status: "paid", paid_at: "2026-06-03" }],
        payments: [{ amount_cents: 2000, status: "paid", created_at: "2026-06-09" }],
        profiles: [{ created_at: "2026-06-01" }],
        ceus: [{ completion_date: "2026-05-01" }, { created_at: "2026-06-12" }],
      },
      12,
      NOW,
    );
    const jun = t.find((p) => p.month === "2026-06")!;
    const may = t.find((p) => p.month === "2026-05")!;
    expect(jun.revenueCents).toBe(12000);
    expect(jun.certsIssued).toBe(1);
    expect(jun.newMembers).toBe(1);
    expect(jun.ceusLogged).toBe(1);
    expect(may.certsIssued).toBe(1);
    expect(may.ceusLogged).toBe(1);
  });
});

describe("computeCertsByType", () => {
  it("counts active certs by type, descending, ignoring non-active", () => {
    const slices = computeCertsByType([
      { cert_type: "CAC", status: "active" },
      { cert_type: "CAC", status: "active" },
      { cert_type: "CADC", status: "active" },
      { cert_type: "CCS", status: "expired" },
    ]);
    expect(slices).toEqual([
      { certType: "CAC", count: 2 },
      { certType: "CADC", count: 1 },
    ]);
  });

  it("is empty-safe", () => {
    expect(computeCertsByType([])).toEqual([]);
  });
});
