import { describe, it, expect } from "vitest";
import { buildActivityFeed, type ActivityEvent, type ActivitySources } from "@/lib/activity";

// Pins the integration contract between the admin member-detail page
// (src/app/(admin)/admin/members/[id]/page.tsx) and the activity lib. The page
// reuses already-fetched row variables — whose LOCAL names differ from the lib's
// source keys — and maps them like this:
//   applications -> applications, certs -> certifications, payments -> payments,
//   invoices -> invoices, ceuRecords -> ceuRecords, documents -> documents,
//   docRequests -> documentRequests, messages -> messages,
//   nameChanges -> nameChangeRequests, reciprocity -> reciprocityRequests.
// We rebuild that exact mapping here from representative member rows.

// Representative rows shaped like the page's Supabase selects.
const applications = [{ id: "a1", app_type: "initial_certification", status: "under_review", submitted_at: "2026-06-01T10:00:00Z" }];
const certs = [{ id: "c1", cert_type: "CADC", cert_number: "AZ-CADC-1", issued_date: "2026-05-15", status: "active" }];
const payments = [{ id: "p1", amount_cents: 15000, product_name: "Renewal", status: "paid", created_at: "2026-06-05T10:00:00Z" }];
const invoices = [{ id: "i1", invoice_number: "INV-1", amount_cents: 15000, description: "Renewal", status: "unpaid", created_at: "2026-06-04T10:00:00Z" }];
const ceuRecords = [{ id: "e1", course_name: "Ethics", hours: 3, status: "approved", completion_date: "2026-03-01" }];
const documents = [{ id: "d1", document_type: "Education Verification", status: "accepted", uploaded_at: "2026-02-01T10:00:00Z" }];
const docRequests = [{ id: "dr1", document_type: "Training Verification", note: "Please upload", created_at: "2026-06-08T10:00:00Z" }];
const messages = [{ id: "m1", subject: "Welcome", from_name: "ABCAC", created_at: "2026-06-09T10:00:00Z" }];
const nameChanges = [{ id: "n1", new_name: "Jane Doe", status: "pending", submitted_at: "2026-06-02T10:00:00Z" }];
const reciprocity = [{ id: "r1", destination: "Nevada", status: "pending", submitted_at: "2026-06-03T10:00:00Z" }];

/** The exact sources object the admin page constructs. */
function adminSources(): ActivitySources {
  return {
    applications,
    certifications: certs,
    payments,
    invoices,
    ceuRecords,
    documents,
    documentRequests: docRequests,
    messages,
    nameChangeRequests: nameChanges,
    reciprocityRequests: reciprocity,
  };
}

describe("admin member-detail activity feed", () => {
  it("maps the page's local row variables onto every source key", () => {
    const feed = buildActivityFeed(adminSources(), { limit: 40 });
    expect(feed).toHaveLength(10);
    expect(feed.map((e) => e.type).sort()).toEqual(
      [
        "application",
        "certification",
        "ceu",
        "document",
        "document_request",
        "invoice",
        "message",
        "name_change",
        "payment",
        "reciprocity",
      ],
    );
  });

  it("returns newest-first events for the member dataset", () => {
    const feed = buildActivityFeed(adminSources(), { limit: 40 });
    const ts = feed.map((e) => (e.timestamp ? Date.parse(e.timestamp) : 0));
    const sorted = [...ts].sort((a, b) => b - a);
    expect(ts).toEqual(sorted);
    // message (Jun 9) is newest, document (Feb 1) is oldest.
    expect(feed[0].type).toBe("message");
    expect(feed[feed.length - 1].type).toBe("document");
  });

  it("produces correctly-typed events (id/type/title/timestamp present)", () => {
    const feed = buildActivityFeed(adminSources(), { limit: 40 });
    for (const e of feed satisfies ActivityEvent[]) {
      expect(typeof e.id).toBe("string");
      expect(e.id).toContain(":");
      expect(typeof e.type).toBe("string");
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.timestamp == null || typeof e.timestamp === "string").toBe(true);
    }
  });

  it("honors the limit:40 the page passes", () => {
    // 50 message rows -> feed must cap at 40.
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: `m${i}`,
      subject: `S${i}`,
      from_name: "ABCAC",
      created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    const feed = buildActivityFeed({ ...adminSources(), messages: many }, { limit: 40 });
    expect(feed).toHaveLength(40);
  });

  it("degrades to an empty feed when the member has no activity", () => {
    // Mirrors the page passing empty safeList() results — the section then shows
    // its emptyText rather than crashing.
    const feed = buildActivityFeed(
      {
        applications: [],
        certifications: [],
        payments: [],
        invoices: [],
        ceuRecords: [],
        documents: [],
        documentRequests: [],
        messages: [],
        nameChangeRequests: [],
        reciprocityRequests: [],
      },
      { limit: 40 },
    );
    expect(feed).toEqual([]);
  });

  it("keeps the member-portal links off the admin staff view's data", () => {
    // The page renders with linkable={false}; the events still carry portal links
    // but the admin timeline must not depend on them being staff-usable.
    const feed = buildActivityFeed(adminSources(), { limit: 40 });
    const ceu = feed.find((e) => e.type === "ceu")!;
    expect(ceu.link).toBe("/account/ceus");
    expect(ceu.title).toContain("Ethics");
  });
});
