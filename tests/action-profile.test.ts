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

import { updateMemberProfile } from "@/app/(admin)/admin/members/[id]/profile-actions";

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

describe("updateMemberProfile", () => {
  it("rejects a missing member id", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await updateMemberProfile("", { first_name: "A" })).toEqual({
      ok: false,
      error: "bad_request",
    });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await updateMemberProfile("m1", { first_name: "A" })).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await updateMemberProfile("m1", { first_name: "A" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(adminRef.current!.callsFor("profiles", "update")).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns no_fields when nothing editable is supplied", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await updateMemberProfile("m1", {})).toEqual({ ok: false, error: "no_fields" });
    expect(adminRef.current!.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("admin: updates ONLY whitelisted columns via the admin client + audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const res = await updateMemberProfile("m1", {
      first_name: "Jane",
      last_name: "Doe",
      phone: "555-1234",
      city: "Austin",
      // Non-whitelisted keys must be ignored.
      portal_role: "superadmin",
      account_status: "active",
      email: "x@y.z",
    } as never);
    expect(res).toEqual({ ok: true });

    const upd = adminRef.current!.callsFor("profiles", "update")[0];
    expect(upd.payload).toEqual({
      first_name: "Jane",
      last_name: "Doe",
      phone: "555-1234",
      city: "Austin",
    });
    expect(upd.filters).toContainEqual({ col: "id", val: "m1" });

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "admin1",
      action: "profile_updated",
      target_table: "profiles",
      target_id: "m1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("coerces empty/whitespace values to null", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    await updateMemberProfile("m1", { first_name: "Jane", middle_name: "  " });
    expect(adminRef.current!.callsFor("profiles", "update")[0].payload).toEqual({
      first_name: "Jane",
      middle_name: null,
    });
  });

  it("surfaces an update error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "profiles" && op === "update" ? { error: { message: "denied" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await updateMemberProfile("m1", { first_name: "A" })).toEqual({
      ok: false,
      error: "denied",
    });
  });
});
