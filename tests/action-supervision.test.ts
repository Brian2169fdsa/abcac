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
  upsertSupervisionRecord,
  deleteSupervisionRecord,
  setSupervisee,
  upsertAuthorization,
  deleteAuthorization,
} from "@/app/(admin)/admin/members/[id]/supervision-actions";

beforeEach(() => {
  revalidatePath.mockClear();
});

function setup(opts: { user: { id: string } | null; callerRole: string | null; adminResult?: ResultFor }) {
  serverRef.current = makeClient(opts.user, (table) =>
    table === "profiles" ? { data: { portal_role: opts.callerRole } } : { data: null },
  );
  adminRef.current = makeClient(
    opts.user,
    opts.adminResult ?? ((table, op) => (op === "insert" ? { data: { id: "new1" } } : { data: null })),
  );
}

describe("upsertSupervisionRecord", () => {
  it("rejects an empty supervisee name", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await upsertSupervisionRecord("m1", { superviseeName: "  " })).toEqual({
      ok: false,
      error: "bad_request",
    });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await upsertSupervisionRecord("m1", { superviseeName: "Jane" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(adminRef.current!.calls).toHaveLength(0);
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await upsertSupervisionRecord("m1", { superviseeName: "Jane" })).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("admin insert: pins supervisor_id = memberId and audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const res = await upsertSupervisionRecord("m1", {
      superviseeName: "Jane Doe",
      superviseeCredential: " BCBA ",
      startDate: " 2026-01-01 ",
      endDate: "",
      status: "active",
    });
    expect(res).toEqual({ ok: true });
    const ins = adminRef.current!.callsFor("supervision_records", "insert")[0];
    expect(ins.payload).toMatchObject({
      supervisor_id: "m1",
      supervisee_name: "Jane Doe",
      supervisee_credential: "BCBA",
      start_date: "2026-01-01",
      end_date: null,
      status: "active",
    });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      action: "supervision_record_created",
      target_table: "supervision_records",
      target_id: "new1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("admin update: scopes by id AND supervisor_id", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await upsertSupervisionRecord("m1", { id: "r1", superviseeName: "Jane" })).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("supervision_records", "update")[0];
    expect(upd.payload).toMatchObject({ supervisor_id: "m1", supervisee_name: "Jane" });
    expect(upd.filters).toContainEqual({ col: "id", val: "r1" });
    expect(upd.filters).toContainEqual({ col: "supervisor_id", val: "m1" });
  });
});

describe("deleteSupervisionRecord", () => {
  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await deleteSupervisionRecord("m1", "r1")).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin: deletes scoped by id AND supervisor_id and audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await deleteSupervisionRecord("m1", "r1")).toEqual({ ok: true });
    const del = adminRef.current!.callsFor("supervision_records", "delete")[0];
    expect(del.filters).toContainEqual({ col: "id", val: "r1" });
    expect(del.filters).toContainEqual({ col: "supervisor_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "supervision_record_deleted", target_id: "r1" });
  });
});

describe("setSupervisee", () => {
  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await setSupervisee("m1", "r1", "s1")).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects linking the member to themselves", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setSupervisee("m1", "r1", "m1")).toEqual({ ok: false, error: "cannot_link_self" });
  });

  it("admin link: updates supervisee_member_id scoped by id AND supervisor_id", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setSupervisee("m1", "r1", "s9")).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("supervision_records", "update")[0];
    expect(upd.payload).toEqual({ supervisee_member_id: "s9" });
    expect(upd.filters).toContainEqual({ col: "id", val: "r1" });
    expect(upd.filters).toContainEqual({ col: "supervisor_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "supervisee_linked", target_id: "r1" });
  });

  it("admin unlink: sets supervisee_member_id to null", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setSupervisee("m1", "r1", null)).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("supervision_records", "update")[0];
    expect(upd.payload).toEqual({ supervisee_member_id: null });
  });
});

describe("upsertAuthorization", () => {
  it("rejects an empty authorization type", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await upsertAuthorization("m1", { authorizationType: " " })).toEqual({
      ok: false,
      error: "bad_request",
    });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await upsertAuthorization("m1", { authorizationType: "Approved Supervisor" })).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("admin insert: pins member_id, normalizes bad status to active, audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const res = await upsertAuthorization("m1", {
      authorizationType: "Approved Supervisor",
      detail: " grants ",
      status: "bogus",
      adminNotes: "  ",
    });
    expect(res).toEqual({ ok: true });
    const ins = adminRef.current!.callsFor("supervision_authorizations", "insert")[0];
    expect(ins.payload).toMatchObject({
      member_id: "m1",
      authorization_type: "Approved Supervisor",
      detail: "grants",
      status: "active",
      admin_notes: null,
    });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      action: "supervision_authorization_created",
      target_table: "supervision_authorizations",
      target_id: "new1",
    });
  });

  it("admin update: scopes by id AND member_id, preserves valid status", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(
      await upsertAuthorization("m1", { id: "a1", authorizationType: "x", status: "revoked" }),
    ).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("supervision_authorizations", "update")[0];
    expect(upd.payload).toMatchObject({ member_id: "m1", status: "revoked" });
    expect(upd.filters).toContainEqual({ col: "id", val: "a1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
  });

  it("surfaces an insert error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "supervision_authorizations" && op === "insert" ? { error: { message: "fail" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await upsertAuthorization("m1", { authorizationType: "x" })).toEqual({
      ok: false,
      error: "fail",
    });
  });
});

describe("deleteAuthorization", () => {
  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await deleteAuthorization("m1", "a1")).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin: deletes scoped by id AND member_id and audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await deleteAuthorization("m1", "a1")).toEqual({ ok: true });
    const del = adminRef.current!.callsFor("supervision_authorizations", "delete")[0];
    expect(del.filters).toContainEqual({ col: "id", val: "a1" });
    expect(del.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "supervision_authorization_deleted", target_id: "a1" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });
});
