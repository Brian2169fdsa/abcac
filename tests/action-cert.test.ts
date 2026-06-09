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
  updateCertification,
  setCertStatus,
  toggleCertSync,
} from "@/app/(admin)/admin/members/[id]/cert-actions";

beforeEach(() => {
  revalidatePath.mockClear();
});

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

describe("updateCertification", () => {
  it("rejects missing ids", async () => {
    setup({ user: { id: "a1" }, callerRole: "admin" });
    expect(await updateCertification("", "c1", { cert_number: "1" })).toEqual({ ok: false, error: "bad_request" });
    expect(await updateCertification("m1", "", { cert_number: "1" })).toEqual({ ok: false, error: "bad_request" });
  });

  it("rejects an empty patch", async () => {
    setup({ user: { id: "a1" }, callerRole: "admin" });
    expect(await updateCertification("m1", "c1", {})).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await updateCertification("m1", "c1", { cert_number: "1" })).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await updateCertification("m1", "c1", { cert_number: "1" })).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.callsFor("certifications", "update")).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("admin: updates scoped by id AND member_id, audits, revalidates", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const res = await updateCertification("m1", "c1", {
      cert_number: "  555  ",
      issued_date: "2026-01-01",
      expiration_date: "2028-01-01",
      ic_rc_level: "Level II",
    });
    expect(res).toEqual({ ok: true });

    const upd = adminRef.current!.callsFor("certifications", "update")[0];
    expect(upd.payload).toEqual({
      cert_number: "555",
      issued_date: "2026-01-01",
      expiration_date: "2028-01-01",
      ic_rc_level: "Level II",
    });
    expect(upd.filters).toContainEqual({ col: "id", val: "c1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "admin1",
      action: "certification_updated",
      target_id: "c1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("only patches the provided keys and nulls empty strings", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    await updateCertification("m1", "c1", { cert_number: "  " });
    expect(adminRef.current!.callsFor("certifications", "update")[0].payload).toEqual({ cert_number: null });
  });

  it("surfaces an update error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "certifications" && op === "update" ? { error: { message: "nope" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await updateCertification("m1", "c1", { cert_number: "1" })).toEqual({ ok: false, error: "nope" });
  });
});

describe("setCertStatus", () => {
  it("rejects an invalid status", async () => {
    setup({ user: { id: "a1" }, callerRole: "admin" });
    expect(await setCertStatus("m1", "c1", "wizard")).toEqual({ ok: false, error: "bad_request" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await setCertStatus("m1", "c1", "revoked")).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.callsFor("certifications", "update")).toHaveLength(0);
  });

  it.each(["active", "expired", "revoked"] as const)("admin: sets status %s scoped + audited", async (status) => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setCertStatus("m1", "c1", status)).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("certifications", "update")[0];
    expect(upd.payload).toEqual({ status });
    expect(upd.filters).toContainEqual({ col: "id", val: "c1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "certification_status_changed", target_id: "c1", details: { status } });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("surfaces an update error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "certifications" && op === "update" ? { error: { message: "denied" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await setCertStatus("m1", "c1", "revoked")).toEqual({ ok: false, error: "denied" });
  });
});

describe("toggleCertSync", () => {
  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await toggleCertSync("m1", "c1", true)).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.callsFor("certifications", "update")).toHaveLength(0);
  });

  it("rejects missing ids", async () => {
    setup({ user: { id: "a1" }, callerRole: "admin" });
    expect(await toggleCertSync("", "c1", true)).toEqual({ ok: false, error: "bad_request" });
  });

  it.each([true, false])("admin: toggles sync_enabled=%s scoped + audited", async (enabled) => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await toggleCertSync("m1", "c1", enabled)).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("certifications", "update")[0];
    expect(upd.payload).toEqual({ sync_enabled: enabled });
    expect(upd.filters).toContainEqual({ col: "id", val: "c1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "certification_sync_toggled", details: { sync_enabled: enabled } });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });
});
