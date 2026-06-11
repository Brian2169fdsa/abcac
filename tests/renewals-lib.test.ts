import { describe, it, expect } from "vitest";
import {
  classifyRenewal,
  buildRenewalPipeline,
  daysToExpiry,
  RENEWAL_WINDOW_DAYS,
  type CertInput,
  type InvoiceInput,
  type ProfileInput,
} from "@/lib/renewals";

const NOW = new Date("2026-06-11T00:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10);

const cert = (over: Partial<CertInput> = {}): CertInput => ({
  member_id: "m1", cert_type: "CADC", cert_number: "AZ-1", status: "active", expiration_date: inDays(30), ...over,
});
const renewalInv = (status: string, over: Partial<InvoiceInput> = {}): InvoiceInput => ({
  member_id: "m1", invoice_number: "INV-1", description: "Biennial certification renewal — CADC",
  amount_cents: 15000, status, created_at: NOW.toISOString(), ...over,
});

describe("daysToExpiry", () => {
  it("computes signed day deltas and handles null/bad input", () => {
    expect(daysToExpiry(inDays(30), NOW)).toBe(30);
    expect(daysToExpiry(inDays(-5), NOW)).toBe(-5);
    expect(daysToExpiry(null, NOW)).toBeNull();
    expect(daysToExpiry("not-a-date", NOW)).toBeNull();
  });
});

describe("classifyRenewal", () => {
  it("lapsed: expired status or past expiration", () => {
    expect(classifyRenewal(cert({ status: "expired" }), null, NOW)).toBe("lapsed");
    expect(classifyRenewal(cert({ expiration_date: inDays(-1) }), null, NOW)).toBe("lapsed");
    expect(classifyRenewal(cert({ status: "inactive" }), null, NOW)).toBe("lapsed");
  });

  it("upcoming: active, within window, no renewal invoice", () => {
    expect(classifyRenewal(cert({ expiration_date: inDays(45) }), null, NOW)).toBe("upcoming");
  });

  it("current: active, beyond window, no invoice", () => {
    expect(classifyRenewal(cert({ expiration_date: inDays(RENEWAL_WINDOW_DAYS + 30) }), null, NOW)).toBe("current");
  });

  it("invoiced: unpaid renewal invoice", () => {
    expect(classifyRenewal(cert(), renewalInv("unpaid"), NOW)).toBe("invoiced");
  });

  it("paid_processing: paid invoice but cert still near expiry", () => {
    expect(classifyRenewal(cert({ expiration_date: inDays(20) }), renewalInv("paid"), NOW)).toBe("paid_processing");
  });

  it("renewed: paid invoice and cert extended past the horizon", () => {
    expect(classifyRenewal(cert({ expiration_date: inDays(700) }), renewalInv("paid"), NOW)).toBe("renewed");
  });
});

describe("buildRenewalPipeline", () => {
  const profiles: ProfileInput[] = [
    { id: "m1", first_name: "Linda", last_name: "Tran", email: "linda@example.com" },
    { id: "m2", first_name: "Bob", last_name: "Vance", email: null },
  ];

  it("buckets, counts, sorts by urgency, and excludes 'current' from rows", () => {
    const certs = [
      cert({ member_id: "m1", expiration_date: inDays(10) }), // upcoming (no inv)
      cert({ member_id: "m2", expiration_date: inDays(60) }), // invoiced (unpaid inv)
      cert({ member_id: "m1", cert_number: "AZ-2", expiration_date: inDays(5) }), // upcoming, more urgent
      cert({ member_id: "m2", cert_number: "AZ-3", status: "expired", expiration_date: inDays(-30) }), // lapsed
      cert({ member_id: "m1", cert_number: "AZ-4", expiration_date: inDays(400) }), // current → excluded
    ];
    const invoices = [renewalInv("unpaid", { member_id: "m2" })];
    const p = buildRenewalPipeline(certs, invoices, profiles, NOW);

    expect(p.counts.upcoming).toBe(2);
    expect(p.counts.invoiced).toBe(1);
    expect(p.counts.lapsed).toBe(1);
    expect(p.counts.current).toBe(1);
    // rows excludes current (4 actionable of 5 certs)
    expect(p.rows).toHaveLength(4);
    expect(p.rows.every((r) => r.stage !== "current")).toBe(true);
    // upcoming sorted by soonest expiry: AZ-2 (5d) before AZ-1 (10d)
    const upcoming = p.byStage.upcoming.map((r) => r.certNumber);
    expect(upcoming).toEqual(["AZ-2", "AZ-1"]);
    // member name resolved
    expect(p.byStage.invoiced[0].memberName).toBe("Bob Vance");
    expect(p.byStage.invoiced[0].invoiceStatus).toBe("unpaid");
  });

  it("tallies outstanding vs collected renewal revenue", () => {
    const certs = [cert({ member_id: "m1" }), cert({ member_id: "m2", expiration_date: inDays(700) })];
    const invoices = [
      renewalInv("unpaid", { member_id: "m1", amount_cents: 15000 }),
      renewalInv("paid", { member_id: "m2", amount_cents: 15000 }),
    ];
    const p = buildRenewalPipeline(certs, invoices, profiles, NOW);
    expect(p.outstandingCents).toBe(15000);
    expect(p.collectedCents).toBe(15000);
  });

  it("is empty-safe", () => {
    const p = buildRenewalPipeline([], [], [], NOW);
    expect(p.rows).toEqual([]);
    expect(p.counts.upcoming).toBe(0);
  });
});
