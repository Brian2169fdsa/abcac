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
  sendMemberMessage,
  requestMemberDocument,
  changeMemberRole,
} from "@/app/(admin)/admin/members/[id]/cockpit-actions";

beforeEach(() => {
  revalidatePath.mockClear();
});

/** Server client returns the caller's role; admin client uses adminResult. */
function setup(opts: {
  user: { id: string } | null;
  callerRole: string | null;
  serverResult?: ResultFor;
  adminResult?: ResultFor;
}) {
  serverRef.current = makeClient(
    opts.user,
    opts.serverResult ??
      ((table) => (table === "profiles" ? { data: { portal_role: opts.callerRole } } : { data: null })),
  );
  adminRef.current = makeClient(opts.user, opts.adminResult ?? (() => ({ data: null })));
}

describe("sendMemberMessage", () => {
  it("rejects missing member or subject", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await sendMemberMessage("", "hi", "body")).toEqual({ ok: false, error: "bad_request" });
    expect(await sendMemberMessage("m1", "   ", "body")).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await sendMemberMessage("m1", "hi", "body")).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await sendMemberMessage("m1", "hi", "body")).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.calls).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("admin: inserts the message, audits, revalidates", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const res = await sendMemberMessage("m1", "Hello", "Body text");
    expect(res).toEqual({ ok: true });

    const ins = adminRef.current!.callsFor("messages", "insert")[0];
    expect(ins.payload).toMatchObject({
      member_id: "m1",
      from_name: "ABCAC Admin",
      subject: "Hello",
      body: "Body text",
      is_read: false,
    });

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ admin_id: "admin1", action: "message_sent" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("empty body is stored as null", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    await sendMemberMessage("m1", "Hello", "   ");
    expect(adminRef.current!.callsFor("messages", "insert")[0].payload).toMatchObject({ body: null });
  });

  it("surfaces an insert error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "messages" && op === "insert" ? { error: { message: "nope" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await sendMemberMessage("m1", "Hello", "x")).toEqual({ ok: false, error: "nope" });
  });
});

describe("requestMemberDocument", () => {
  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await requestMemberDocument("m1", "ID", "note")).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects missing document type", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await requestMemberDocument("m1", "  ", "note")).toEqual({ ok: false, error: "bad_request" });
  });

  it("admin: inserts a document_requests row with status open + audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await requestMemberDocument("m1", "Drivers License", "asap")).toEqual({ ok: true });
    const ins = adminRef.current!.callsFor("document_requests", "insert")[0];
    expect(ins.payload).toMatchObject({
      member_id: "m1",
      document_type: "Drivers License",
      note: "asap",
      status: "open",
    });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "document_requested" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });
});

describe("changeMemberRole", () => {
  it("rejects an invalid role", async () => {
    setup({ user: { id: "s1" }, callerRole: "superadmin" });
    expect(await changeMemberRole("m1", "wizard")).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await changeMemberRole("m1", "admin")).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain admin (superadmin-only)", async () => {
    setup({ user: { id: "a1" }, callerRole: "admin" });
    expect(await changeMemberRole("m1", "admin")).toEqual({ ok: false, error: "forbidden" });
    // No profile update attempted.
    expect(serverRef.current!.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("refuses changing the caller's own role", async () => {
    setup({ user: { id: "s1" }, callerRole: "superadmin" });
    expect(await changeMemberRole("s1", "member")).toEqual({ ok: false, error: "cannot_change_self" });
    expect(serverRef.current!.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("returns not_found when the target profile is missing", async () => {
    // The action does two profiles selects on the session client: the first is
    // the caller (superadmin), the second is the target. Count to distinguish.
    let sel = 0;
    serverRef.current = makeClient({ id: "s1" }, (table, op) => {
      if (table === "profiles" && op === "select") {
        sel += 1;
        // first call = caller (superadmin); second = target (missing)
        return sel === 1 ? { data: { portal_role: "superadmin" } } : { data: null };
      }
      return { data: null };
    });
    expect(await changeMemberRole("m1", "admin")).toEqual({ ok: false, error: "not_found" });
  });

  it("no-ops when the new role equals the current role", async () => {
    let sel = 0;
    serverRef.current = makeClient({ id: "s1" }, (table, op) => {
      if (table === "profiles" && op === "select") {
        sel += 1;
        return sel === 1 ? { data: { portal_role: "superadmin" } } : { data: { portal_role: "admin" } };
      }
      return { data: null };
    });
    adminRef.current = makeClient({ id: "s1" }, () => ({ data: null }));
    expect(await changeMemberRole("m1", "admin")).toEqual({ ok: true });
    expect(serverRef.current!.callsFor("profiles", "update")).toHaveLength(0);
  });

  it("superadmin: updates via the caller's OWN session client + audits via admin client", async () => {
    let sel = 0;
    serverRef.current = makeClient({ id: "s1" }, (table, op) => {
      if (table === "profiles" && op === "select") {
        sel += 1;
        return sel === 1 ? { data: { portal_role: "superadmin" } } : { data: { portal_role: "member" } };
      }
      return { data: null };
    });
    adminRef.current = makeClient({ id: "s1" }, () => ({ data: null }));

    const res = await changeMemberRole("m1", "admin");
    expect(res).toEqual({ ok: true });

    // The privileged role write goes through the SERVER (session) client, NOT
    // the service-role admin client — this is load-bearing for the DB guard.
    const upd = serverRef.current!.callsFor("profiles", "update")[0];
    expect(upd).toBeTruthy();
    expect(upd.payload).toEqual({ portal_role: "admin" });
    expect(upd.filters).toContainEqual({ col: "id", val: "m1" });
    expect(adminRef.current!.callsFor("profiles", "update")).toHaveLength(0);

    // Audit (old member -> new admin) goes through the admin client.
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "s1",
      action: "role_changed",
      target_id: "m1",
      details: { member_id: "m1", old_role: "member", new_role: "admin" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("surfaces a role-update error", async () => {
    let sel = 0;
    serverRef.current = makeClient({ id: "s1" }, (table, op): QueryResult => {
      if (table === "profiles" && op === "select") {
        sel += 1;
        return sel === 1 ? { data: { portal_role: "superadmin" } } : { data: { portal_role: "member" } };
      }
      if (table === "profiles" && op === "update") return { error: { message: "guard denied" } };
      return { data: null };
    });
    adminRef.current = makeClient({ id: "s1" }, () => ({ data: null }));
    expect(await changeMemberRole("m1", "admin")).toEqual({ ok: false, error: "guard denied" });
  });
});
