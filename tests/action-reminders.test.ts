import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type ResultFor } from "./helpers/supabase-fake";

const serverRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const adminRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const revalidatePath = vi.fn();
const runRemindersForMembers = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverRef.current!.client,
  createSupabaseAdminClient: () => adminRef.current!.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/reminders-runner", () => ({
  runRemindersForMembers: (...args: unknown[]) => runRemindersForMembers(...args),
}));

import { runMemberReminders } from "@/app/(admin)/admin/members/[id]/reminder-actions";

beforeEach(() => {
  revalidatePath.mockClear();
  runRemindersForMembers.mockReset();
});

function setup(opts: { user: { id: string } | null; callerRole: string | null; adminResult?: ResultFor }) {
  serverRef.current = makeClient(opts.user, (table) =>
    table === "profiles" ? { data: { portal_role: opts.callerRole } } : { data: null },
  );
  adminRef.current = makeClient(opts.user, opts.adminResult ?? (() => ({ data: null })));
}

describe("runMemberReminders", () => {
  it("rejects an empty member id", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await runMemberReminders("")).toEqual({ ok: false, error: "bad_request" });
    expect(runRemindersForMembers).not.toHaveBeenCalled();
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await runMemberReminders("m1")).toEqual({ ok: false, error: "unauthorized" });
    expect(runRemindersForMembers).not.toHaveBeenCalled();
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await runMemberReminders("m1")).toEqual({ ok: false, error: "forbidden" });
    expect(runRemindersForMembers).not.toHaveBeenCalled();
  });

  it("admin: calls the runner with the admin client, [memberId], and caller id", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    runRemindersForMembers.mockResolvedValue({ remindersSent: 3, emailsSent: 2 });

    const res = await runMemberReminders("m1");
    expect(res).toEqual({ ok: true, remindersSent: 3, emailsSent: 2 });

    expect(runRemindersForMembers).toHaveBeenCalledTimes(1);
    const [clientArg, membersArg, callerArg] = runRemindersForMembers.mock.calls[0];
    expect(clientArg).toBe(adminRef.current!.client);
    expect(membersArg).toEqual(["m1"]);
    expect(callerArg).toBe("admin1");

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "admin1",
      action: "reminders_run",
      target_table: "reminder_log",
      details: { member_id: "m1", reminders_sent: 3, emails_sent: 2 },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("superadmin caller is allowed", async () => {
    setup({ user: { id: "s1" }, callerRole: "superadmin" });
    runRemindersForMembers.mockResolvedValue({ remindersSent: 0, emailsSent: 0 });
    expect(await runMemberReminders("m1")).toEqual({ ok: true, remindersSent: 0, emailsSent: 0 });
  });

  it("surfaces a runner failure as an error result", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    runRemindersForMembers.mockRejectedValue(new Error("smtp exploded"));
    expect(await runMemberReminders("m1")).toEqual({ ok: false, error: "smtp exploded" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
