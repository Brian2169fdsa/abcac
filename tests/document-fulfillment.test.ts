import { describe, it, expect } from "vitest";
import { makeClient, type ResultFor, type QueryResult } from "./helpers/supabase-fake";
import {
  normalizeDocType,
  requestMatchesUpload,
  fulfillMatchingDocumentRequests,
  FULFILLED_STATUS,
  OPEN_STATUS,
} from "@/lib/document-fulfillment";

const MEMBER = "m1";

/** A resultFor where the open-requests select returns `rows` and updates succeed. */
function withOpenRequests(rows: Array<{ id: string; document_type: string | null }>, updateError?: unknown): ResultFor {
  return (table, op): QueryResult => {
    if (table === "document_requests" && op === "select") return { data: rows };
    if (table === "document_requests" && op === "update") {
      return updateError ? { data: null, error: updateError } : { data: null };
    }
    return { data: null };
  };
}

// ── pure matching predicate ───────────────────────────────────────────────────
describe("requestMatchesUpload", () => {
  it("matches exact document types", () => {
    expect(requestMatchesUpload("Education Verification", "Education Verification")).toBe(true);
  });

  it("matches case-insensitively and trimmed", () => {
    expect(requestMatchesUpload("  education verification ", "EDUCATION VERIFICATION")).toBe(true);
  });

  it("does not match different document types", () => {
    expect(requestMatchesUpload("Education Verification", "Training Verification (Certificate)")).toBe(false);
  });

  it("never matches when either side is blank/null", () => {
    expect(requestMatchesUpload("", "Education Verification")).toBe(false);
    expect(requestMatchesUpload("Education Verification", "")).toBe(false);
    expect(requestMatchesUpload(null, null)).toBe(false);
    expect(requestMatchesUpload("   ", "Education Verification")).toBe(false);
  });

  it("normalizeDocType trims and lower-cases", () => {
    expect(normalizeDocType("  Foo Bar ")).toBe("foo bar");
    expect(normalizeDocType(null)).toBe("");
  });
});

// ── fulfillment side-effects ──────────────────────────────────────────────────
describe("fulfillMatchingDocumentRequests", () => {
  it("flips the matching open request to fulfilled with fulfilled_at, scoped to the member", async () => {
    const fake = makeClient(
      { id: MEMBER },
      withOpenRequests([
        { id: "req-edu", document_type: "Education Verification" },
        { id: "req-train", document_type: "Training Verification (Certificate)" },
      ]),
    );

    const res = await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "education verification");
    expect(res.fulfilledIds).toEqual(["req-edu"]);

    const upd = fake.callsFor("document_requests", "update");
    expect(upd).toHaveLength(1);
    expect(upd[0].payload).toMatchObject({ status: FULFILLED_STATUS });
    expect(upd[0].payload).toHaveProperty("fulfilled_at");
    expect((upd[0].payload as { fulfilled_at: string }).fulfilled_at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    // Scoped: id + member_id + still-open guard on the update.
    expect(upd[0].filters).toContainEqual({ col: "id", val: "req-edu" });
    expect(upd[0].filters).toContainEqual({ col: "member_id", val: MEMBER });
    expect(upd[0].filters).toContainEqual({ col: "status", val: OPEN_STATUS });
  });

  it("scopes the open-requests read to the member and open status", async () => {
    const fake = makeClient({ id: MEMBER }, withOpenRequests([{ id: "req-edu", document_type: "Education Verification" }]));
    await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "Education Verification");
    const sel = fake.callsFor("document_requests", "select");
    expect(sel).toHaveLength(1);
    expect(sel[0].filters).toContainEqual({ col: "member_id", val: MEMBER });
    expect(sel[0].filters).toContainEqual({ col: "status", val: OPEN_STATUS });
  });

  it("leaves requests untouched when the uploaded type does not match", async () => {
    const fake = makeClient(
      { id: MEMBER },
      withOpenRequests([{ id: "req-edu", document_type: "Education Verification" }]),
    );
    const res = await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "ID / Government Photo ID");
    expect(res.fulfilledIds).toEqual([]);
    expect(fake.callsFor("document_requests", "update")).toHaveLength(0);
  });

  it("fulfills every matching open request of the same type", async () => {
    const fake = makeClient(
      { id: MEMBER },
      withOpenRequests([
        { id: "req-a", document_type: "Education Verification" },
        { id: "req-b", document_type: "education verification" },
        { id: "req-c", document_type: "Supervision Agreement" },
      ]),
    );
    const res = await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "Education Verification");
    expect(res.fulfilledIds.sort()).toEqual(["req-a", "req-b"]);
    expect(fake.callsFor("document_requests", "update")).toHaveLength(2);
  });

  it("only ever reads OPEN requests, so already-fulfilled rows are never modified", async () => {
    // The select is filtered to status=open; a fulfilled row simply is not returned.
    const fake = makeClient({ id: MEMBER }, withOpenRequests([]));
    const res = await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "Education Verification");
    expect(res.fulfilledIds).toEqual([]);
    expect(fake.callsFor("document_requests", "update")).toHaveLength(0);
  });

  it("is a no-op for a blank uploaded type (never sweeps unrelated requests)", async () => {
    const fake = makeClient(
      { id: MEMBER },
      withOpenRequests([{ id: "req-edu", document_type: "Education Verification" }]),
    );
    const res = await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "   ");
    expect(res.fulfilledIds).toEqual([]);
    // Never even queries when there is nothing to match.
    expect(fake.callsFor("document_requests")).toHaveLength(0);
  });

  it("is a no-op without a member id", async () => {
    const fake = makeClient({ id: MEMBER }, withOpenRequests([{ id: "r", document_type: "Education Verification" }]));
    const res = await fulfillMatchingDocumentRequests(fake.client as never, "", "Education Verification");
    expect(res.fulfilledIds).toEqual([]);
    expect(fake.callsFor("document_requests")).toHaveLength(0);
  });

  it("best-effort: a failing update does not throw and reports nothing fulfilled", async () => {
    const fake = makeClient(
      { id: MEMBER },
      withOpenRequests([{ id: "req-edu", document_type: "Education Verification" }], { message: "rls denied" }),
    );
    const res = await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "Education Verification");
    expect(res.fulfilledIds).toEqual([]);
    // It attempted the update but the failure was swallowed.
    expect(fake.callsFor("document_requests", "update")).toHaveLength(1);
  });

  it("best-effort: a failing read does not throw", async () => {
    const fake = makeClient({ id: MEMBER }, (table, op): QueryResult =>
      table === "document_requests" && op === "select" ? { data: null, error: { message: "boom" } } : { data: null },
    );
    const res = await fulfillMatchingDocumentRequests(fake.client as never, MEMBER, "Education Verification");
    expect(res.fulfilledIds).toEqual([]);
    expect(fake.callsFor("document_requests", "update")).toHaveLength(0);
  });

  it("FULFILLED_STATUS matches the admin button vocabulary", () => {
    expect(FULFILLED_STATUS).toBe("fulfilled");
    expect(OPEN_STATUS).toBe("open");
  });
});
