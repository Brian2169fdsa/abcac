import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type ResultFor, type QueryResult } from "./helpers/supabase-fake";

const serverRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const adminRef: { current: ReturnType<typeof makeClient> | null } = { current: null };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverRef.current!.client,
  createSupabaseAdminClient: () => adminRef.current!.client,
}));

import { decideRequest } from "@/app/(admin)/admin/requests/decide-request";
import { decideVerification } from "@/app/(admin)/admin/requests/decide-verification";

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
});

/** caller role → server client; per-table admin results → admin client. */
function setup(opts: {
  user: { id: string } | null;
  callerRole: string | null;
  adminResult?: ResultFor;
}) {
  serverRef.current = makeClient(opts.user, (table) =>
    table === "profiles" ? { data: { portal_role: opts.callerRole } } : { data: null },
  );
  adminRef.current = makeClient(opts.user, opts.adminResult ?? (() => ({ data: null })));
}

describe("decideRequest", () => {
  it("rejects unsupported tables", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await decideRequest("evil_table", "r1", "approve")).toEqual({ ok: false, error: "bad_request" });
  });

  it("rejects invalid decisions", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    // @ts-expect-error deliberately invalid decision
    expect(await decideRequest("name_change_requests", "r1", "nope")).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await decideRequest("name_change_requests", "r1", "approve")).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await decideRequest("name_change_requests", "r1", "approve")).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(adminRef.current!.calls).toHaveLength(0);
  });

  it("approve name_change: updates row, writes profile name, audits", async () => {
    const adminResult: ResultFor = (table, op) => {
      if (table === "name_change_requests" && op === "update") {
        return { data: { member_id: "m1", new_name: "Jane Q Doe" } };
      }
      if (table === "profiles" && op === "select") return { data: { email: null } };
      return { data: null };
    };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });

    const res = await decideRequest("name_change_requests", "r1", "approve", "looks good");
    expect(res).toEqual({ ok: true });

    // Row update sets status completed + reviewer + decided + admin_notes.
    const upd = adminRef.current!.callsFor("name_change_requests", "update")[0];
    expect(upd.payload).toMatchObject({ status: "completed", reviewed_by: "admin1", admin_notes: "looks good" });
    expect(upd.filters).toContainEqual({ col: "id", val: "r1" });

    // Canonical profile name written: "Jane Q Doe" -> first "Jane", last "Q Doe".
    const profUpd = adminRef.current!.callsFor("profiles", "update")[0];
    expect(profUpd.payload).toEqual({ first_name: "Jane", last_name: "Q Doe" });
    expect(profUpd.filters).toContainEqual({ col: "id", val: "m1" });

    // Audit row written with the composed action.
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "admin1",
      action: "name_change_requests_completed",
      target_table: "name_change_requests",
      target_id: "r1",
    });
  });

  it("deny maps to rejected status and does not touch the profile name", async () => {
    const adminResult: ResultFor = (table, op) => {
      if (table === "name_change_requests" && op === "update") {
        return { data: { member_id: "m1", new_name: "Jane Doe" } };
      }
      return { data: null };
    };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    const res = await decideRequest("name_change_requests", "r1", "deny");
    expect(res).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("name_change_requests", "update")[0];
    expect(upd.payload).toMatchObject({ status: "rejected" });
    expect(adminRef.current!.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("reopen clears reviewer/decided fields, sets pending, no email", async () => {
    const adminResult: ResultFor = (table, op) =>
      table === "name_change_requests" && op === "update" ? { data: { member_id: "m1" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    const res = await decideRequest("name_change_requests", "r1", "reopen");
    expect(res).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("name_change_requests", "update")[0];
    expect(upd.payload).toMatchObject({ status: "pending", reviewed_at: null, reviewed_by: null, decided_at: null });
  });

  it("surfaces an update error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "reciprocity_requests" && op === "update"
        ? { data: null, error: { message: "boom" } }
        : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await decideRequest("reciprocity_requests", "r1", "approve")).toEqual({ ok: false, error: "boom" });
  });

  it("superadmin caller is allowed", async () => {
    const adminResult: ResultFor = (table, op) =>
      table === "reciprocity_requests" && op === "update" ? { data: { member_id: null } } : { data: null };
    setup({ user: { id: "s1" }, callerRole: "superadmin", adminResult });
    expect(await decideRequest("reciprocity_requests", "r1", "approve")).toEqual({ ok: true });
  });
});

describe("decideVerification", () => {
  it("rejects bad input", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    // @ts-expect-error invalid result value
    expect(await decideVerification("v1", "maybe")).toEqual({ ok: false, error: "bad_request" });
    // @ts-expect-error missing id
    expect(await decideVerification("", "verified")).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await decideVerification("v1", "verified")).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await decideVerification("v1", "verified")).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.calls).toHaveLength(0);
  });

  it("verified: updates verification_requests with completed status + audits", async () => {
    const adminResult: ResultFor = (table, op) => {
      if (table === "verification_requests" && op === "update") {
        return { data: { requester_email: null } };
      }
      return { data: null };
    };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    const res = await decideVerification("v1", "verified");
    expect(res).toEqual({ ok: true });

    const upd = adminRef.current!.callsFor("verification_requests", "update")[0];
    expect(upd.payload).toMatchObject({ verification_result: "verified", status: "completed" });
    expect(upd.payload).toHaveProperty("verified_at");
    expect(upd.payload).toHaveProperty("completed_at");
    expect(upd.filters).toContainEqual({ col: "id", val: "v1" });

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "admin1",
      action: "verification_requests_verified",
      target_table: "verification_requests",
      target_id: "v1",
    });
  });

  it("not_verified maps to rejected status", async () => {
    const adminResult: ResultFor = (table, op) =>
      table === "verification_requests" && op === "update" ? { data: { requester_email: null } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await decideVerification("v1", "not_verified")).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("verification_requests", "update")[0];
    expect(upd.payload).toMatchObject({ verification_result: "not_verified", status: "rejected" });
  });

  it("surfaces an update error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "verification_requests" && op === "update"
        ? { data: null, error: { message: "db down" } }
        : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await decideVerification("v1", "verified")).toEqual({ ok: false, error: "db down" });
  });
});
