import { describe, it, expect } from "vitest";
import { buildActivityFeed, activityMeta, type ActivitySources } from "@/lib/activity";

const SOURCES: ActivitySources = {
  applications: [{ id: "a1", app_type: "initial_certification", status: "under_review", submitted_at: "2026-06-01T10:00:00Z" }],
  certifications: [{ id: "c1", cert_type: "CADC", cert_number: "AZ-CADC-1", issued_date: "2026-05-15" }],
  payments: [{ id: "p1", amount_cents: 15000, product_name: "Renewal", status: "paid", created_at: "2026-06-05T10:00:00Z" }],
  invoices: [{ id: "i1", invoice_number: "INV-1", amount_cents: 15000, description: "Renewal", status: "unpaid", created_at: "2026-06-04T10:00:00Z" }],
  ceuRecords: [{ id: "e1", course_name: "Ethics", hours: 3, status: "approved", completion_date: "2026-03-01" }],
  documents: [{ id: "d1", document_type: "Education Verification", status: "accepted", uploaded_at: "2026-02-01T10:00:00Z" }],
  documentRequests: [{ id: "dr1", document_type: "Training Verification", note: "Please upload", created_at: "2026-06-08T10:00:00Z" }],
  messages: [{ id: "m1", subject: "Welcome", from_name: "ABCAC", created_at: "2026-06-09T10:00:00Z" }],
  nameChangeRequests: [{ id: "n1", new_name: "Jane Doe", status: "pending", submitted_at: "2026-06-02T10:00:00Z" }],
  reciprocityRequests: [{ id: "r1", destination: "Nevada", status: "pending", submitted_at: "2026-06-03T10:00:00Z" }],
};

describe("buildActivityFeed", () => {
  it("emits one event per source row with stable typed ids", () => {
    const feed = buildActivityFeed(SOURCES);
    expect(feed).toHaveLength(10);
    expect(feed.map((e) => e.type).sort()).toEqual(
      ["application", "certification", "ceu", "document", "document_request", "invoice", "message", "name_change", "payment", "reciprocity"].sort(),
    );
    expect(feed.find((e) => e.type === "invoice")!.id).toBe("invoice:i1");
  });

  it("sorts newest-first by timestamp", () => {
    const ts = buildActivityFeed(SOURCES).map((e) => e.timestamp);
    const sorted = [...ts].sort((a, b) => Date.parse(b ?? "") - Date.parse(a ?? ""));
    expect(ts).toEqual(sorted);
    // message (Jun 9) is newest, document (Feb 1) among oldest
    expect(buildActivityFeed(SOURCES)[0].type).toBe("message");
  });

  it("formats money + titles and links to member routes", () => {
    const feed = buildActivityFeed(SOURCES);
    const inv = feed.find((e) => e.type === "invoice")!;
    expect(inv.title).toContain("INV-1");
    expect(inv.title).toContain("$150");
    expect(inv.link).toBe("/account/invoices");
    const app = feed.find((e) => e.type === "application")!;
    expect(app.title).toBe("Application — Initial Certification");
    expect(app.detail).toBe("Status: Under Review");
  });

  it("honors the limit", () => {
    expect(buildActivityFeed(SOURCES, { limit: 3 })).toHaveLength(3);
  });

  it("is empty-safe and ignores missing sources", () => {
    expect(buildActivityFeed({})).toEqual([]);
    expect(buildActivityFeed({ messages: [] })).toEqual([]);
  });

  it("tolerates rows missing optional fields", () => {
    const feed = buildActivityFeed({ ceuRecords: [{ id: "x" }], invoices: [{}] });
    expect(feed).toHaveLength(2);
    expect(feed.find((e) => e.type === "ceu")!.title).toBe("CEU logged — CEU");
    // invoice with no id still gets a stable fallback id
    expect(feed.find((e) => e.type === "invoice")!.id).toMatch(/^invoice:/);
  });
});

describe("activityMeta", () => {
  it("maps every type to a label/icon/tone", () => {
    expect(activityMeta("payment").icon).toBe("CreditCard");
    expect(activityMeta("certification").label).toBe("Certification");
  });
});
