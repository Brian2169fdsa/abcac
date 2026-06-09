import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type ResultFor, type QueryResult } from "./helpers/supabase-fake";

const serverRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const adminRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverRef.current!.client,
  createSupabaseAdminClient: () => adminRef.current!.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

import {
  setInvoiceStatus,
  updateInvoice,
  setApplicationReview,
  deleteDocument,
} from "@/app/(admin)/admin/members/[id]/billing-actions";

beforeEach(() => {
  revalidatePath.mockClear();
});

function setup(opts: { user: { id: string } | null; callerRole: string | null; adminResult?: ResultFor }) {
  serverRef.current = makeClient(opts.user, (table) =>
    table === "profiles" ? { data: { portal_role: opts.callerRole } } : { data: null },
  );
  adminRef.current = makeClient(opts.user, opts.adminResult ?? (() => ({ data: null })));
}

describe("setInvoiceStatus", () => {
  it("rejects missing ids or an invalid status", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await setInvoiceStatus("", "i1", "paid")).toEqual({ ok: false, error: "bad_request" });
    expect(await setInvoiceStatus("m1", "", "paid")).toEqual({ ok: false, error: "bad_request" });
    expect(await setInvoiceStatus("m1", "i1", "refunded")).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await setInvoiceStatus("m1", "i1", "paid")).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await setInvoiceStatus("m1", "i1", "paid")).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.calls).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("admin: marks paid (stamps paid_at), scoped by id + member_id, audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setInvoiceStatus("m1", "i1", "paid")).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("invoices", "update")[0];
    expect((upd.payload as Record<string, unknown>).status).toBe("paid");
    expect((upd.payload as Record<string, unknown>).paid_at).toBeTruthy();
    expect(upd.filters).toContainEqual({ col: "id", val: "i1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ admin_id: "admin1", action: "invoice_status_changed" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("admin: unpaid/void clears paid_at", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    await setInvoiceStatus("m1", "i1", "void");
    const upd = adminRef.current!.callsFor("invoices", "update")[0];
    expect((upd.payload as Record<string, unknown>).paid_at).toBeNull();
  });

  it("surfaces an update error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "invoices" && op === "update" ? { error: { message: "nope" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await setInvoiceStatus("m1", "i1", "paid")).toEqual({ ok: false, error: "nope" });
  });
});

describe("updateInvoice", () => {
  it("rejects an empty patch", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await updateInvoice("m1", "i1", {})).toEqual({ ok: false, error: "bad_request" });
  });

  it("rejects a blank description / negative amount", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await updateInvoice("m1", "i1", { description: "  " })).toEqual({ ok: false, error: "bad_request" });
    expect(await updateInvoice("m1", "i1", { amount: -5 })).toEqual({ ok: false, error: "bad_request" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await updateInvoice("m1", "i1", { amount: 10 })).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin: converts dollars to cents and trims description", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await updateInvoice("m1", "i1", { amount: 150.5, description: "  Renewal  " })).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("invoices", "update")[0];
    expect(upd.payload).toEqual({ amount_cents: 15050, description: "Renewal" });
    expect(upd.filters).toContainEqual({ col: "id", val: "i1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "invoice_updated" });
  });
});

describe("setApplicationReview", () => {
  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await setApplicationReview("m1", "a1", { admin_notes: "x" })).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin: writes admin_notes + est_completion + reviewed_at, scoped, audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setApplicationReview("m1", "a1", { admin_notes: "  looks good  ", est_completion: "2026-08-01" })).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("applications", "update")[0];
    expect(upd.payload).toMatchObject({ admin_notes: "looks good", est_completion: "2026-08-01" });
    expect((upd.payload as Record<string, unknown>).reviewed_at).toBeTruthy();
    expect(upd.filters).toContainEqual({ col: "id", val: "a1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "application_reviewed" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("admin: empty fields become null", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    await setApplicationReview("m1", "a1", { admin_notes: "   ", est_completion: "  " });
    const upd = adminRef.current!.callsFor("applications", "update")[0];
    expect(upd.payload).toMatchObject({ admin_notes: null, est_completion: null });
  });
});

describe("deleteDocument", () => {
  it("rejects missing ids", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await deleteDocument("", "d1")).toEqual({ ok: false, error: "bad_request" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await deleteDocument("m1", "d1")).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.calls).toHaveLength(0);
  });

  it("admin: deletes the row scoped by id + member_id and audits", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "documents" && op === "select" ? { data: { file_path: "u1/doc.pdf" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await deleteDocument("m1", "d1")).toEqual({ ok: true });
    const del = adminRef.current!.callsFor("documents", "delete")[0];
    expect(del.filters).toContainEqual({ col: "id", val: "d1" });
    expect(del.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      action: "document_deleted",
      details: { member_id: "m1", file_path: "u1/doc.pdf" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("surfaces a delete error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "documents" && op === "delete" ? { error: { message: "denied" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await deleteDocument("m1", "d1")).toEqual({ ok: false, error: "denied" });
  });
});
