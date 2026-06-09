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
  createMemberTask,
  setMemberTaskStatus,
  updateMemberTask,
  deleteMemberTask,
} from "@/app/(admin)/admin/members/[id]/task-actions";

beforeEach(() => {
  revalidatePath.mockClear();
});

function setup(opts: { user: { id: string } | null; callerRole: string | null; adminResult?: ResultFor }) {
  serverRef.current = makeClient(opts.user, (table) =>
    table === "profiles" ? { data: { portal_role: opts.callerRole } } : { data: null },
  );
  // default insert returns an id so audit can reference it.
  adminRef.current = makeClient(
    opts.user,
    opts.adminResult ?? ((table, op) => (op === "insert" && table === "member_tasks" ? { data: { id: "t1" } } : { data: null })),
  );
}

describe("createMemberTask", () => {
  it("rejects an empty title", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await createMemberTask("m1", { title: "  " })).toEqual({ ok: false, error: "bad_request" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await createMemberTask("m1", { title: "Do it" })).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.calls).toHaveLength(0);
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await createMemberTask("m1", { title: "x" })).toEqual({ ok: false, error: "unauthorized" });
  });

  it("admin: inserts with created_by + status open and never sets completed_at", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const res = await createMemberTask("m1", {
      title: "Renew cert",
      detail: "  please  ",
      dueDate: " 2026-07-01 ",
      priority: "high",
      visibleToMember: true,
    });
    expect(res).toEqual({ ok: true });
    const ins = adminRef.current!.callsFor("member_tasks", "insert")[0];
    expect(ins.payload).toMatchObject({
      member_id: "m1",
      title: "Renew cert",
      detail: "please",
      due_date: "2026-07-01",
      priority: "high",
      visible_to_member: true,
      status: "open",
      created_by: "admin1",
    });
    expect(ins.payload).not.toHaveProperty("completed_at");

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "task_created", target_id: "t1" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("normalizes blank due date to null and bad priority to normal", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    await createMemberTask("m1", { title: "x", dueDate: "   ", priority: "urgent" });
    const ins = adminRef.current!.callsFor("member_tasks", "insert")[0];
    expect(ins.payload).toMatchObject({ due_date: null, priority: "normal" });
  });
});

describe("setMemberTaskStatus", () => {
  it("rejects an invalid status", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setMemberTaskStatus("t1", "m1", "frozen")).toEqual({ ok: false, error: "bad_request" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await setMemberTaskStatus("t1", "m1", "done")).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin: scopes update by id AND member_id, sets status, no completed_at", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await setMemberTaskStatus("t1", "m1", "done")).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("member_tasks", "update")[0];
    expect(upd.payload).toEqual({ status: "done" });
    expect(upd.payload).not.toHaveProperty("completed_at");
    expect(upd.filters).toContainEqual({ col: "id", val: "t1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "task_status_changed", target_id: "t1" });
  });

  it("surfaces an update error", async () => {
    const adminResult: ResultFor = (table, op): QueryResult =>
      table === "member_tasks" && op === "update" ? { error: { message: "fail" } } : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await setMemberTaskStatus("t1", "m1", "done")).toEqual({ ok: false, error: "fail" });
  });
});

describe("updateMemberTask", () => {
  it("rejects an empty title", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await updateMemberTask("t1", "m1", { title: " " })).toEqual({ ok: false, error: "bad_request" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await updateMemberTask("t1", "m1", { title: "x" })).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin: scopes update by id AND member_id and never sets completed_at", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await updateMemberTask("t1", "m1", { title: "New", priority: "low" })).toEqual({ ok: true });
    const upd = adminRef.current!.callsFor("member_tasks", "update")[0];
    expect(upd.payload).toMatchObject({ title: "New", priority: "low" });
    expect(upd.payload).not.toHaveProperty("completed_at");
    expect(upd.filters).toContainEqual({ col: "id", val: "t1" });
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
  });
});

describe("deleteMemberTask", () => {
  it("rejects missing ids", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await deleteMemberTask("", "m1")).toEqual({ ok: false, error: "bad_request" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await deleteMemberTask("t1", "m1")).toEqual({ ok: false, error: "forbidden" });
  });

  it("admin: deletes scoped by id AND member_id and audits", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    expect(await deleteMemberTask("t1", "m1")).toEqual({ ok: true });
    const del = adminRef.current!.callsFor("member_tasks", "delete")[0];
    expect(del.filters).toContainEqual({ col: "id", val: "t1" });
    expect(del.filters).toContainEqual({ col: "member_id", val: "m1" });
    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({ action: "task_deleted", target_id: "t1" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });
});
