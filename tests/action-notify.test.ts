import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal chainable fake that ALSO supports .upsert (the shared supabase-fake
// helper only models select/insert/update/delete). Records terminal ops so we
// can assert on the upserted payload and the audit insert.
type Op = "select" | "insert" | "update" | "delete" | "upsert";
type QueryResult = { data?: unknown; error?: unknown };
type ResultFor = (table: string, op: Op) => QueryResult;
type RecordedCall = { table: string; op: Op; payload: unknown; options: unknown };

function makeClient(user: { id: string } | null, resultFor: ResultFor = () => ({ data: null })) {
  const calls: RecordedCall[] = [];
  const from = vi.fn((table: string) => {
    const record: RecordedCall = { table, op: "select", payload: undefined, options: undefined };
    let started = false;
    const builder: Record<string, unknown> = {};
    const resolve = (): QueryResult => {
      const r = resultFor(table, record.op);
      return { data: r.data ?? null, error: r.error ?? null };
    };
    const startOp = (op: Op, payload?: unknown, options?: unknown) => {
      if (!started) {
        record.op = op;
        record.payload = payload;
        record.options = options;
        started = true;
        calls.push(record);
      }
      return builder;
    };
    builder.select = vi.fn((a: unknown) => startOp("select", a));
    builder.insert = vi.fn((p: unknown) => startOp("insert", p));
    builder.update = vi.fn((p: unknown) => startOp("update", p));
    builder.delete = vi.fn(() => startOp("delete"));
    builder.upsert = vi.fn((p: unknown, o: unknown) => startOp("upsert", p, o));
    builder.eq = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(() => Promise.resolve(resolve()));
    builder.single = vi.fn(() => Promise.resolve(resolve()));
    builder.then = (onF: (v: QueryResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onF, onR);
    return builder;
  });
  return {
    client: {
      auth: { getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })) },
      from,
    },
    calls,
    callsFor: (table: string, op?: Op) =>
      calls.filter((c) => c.table === table && (op ? c.op === op : true)),
  };
}

const serverRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const adminRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverRef.current!.client,
  createSupabaseAdminClient: () => adminRef.current!.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

import { setMemberNotificationPrefs } from "@/app/(admin)/admin/members/[id]/notify-actions";

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

const PREFS = {
  renewal_reminders: false,
  ceu_deadline_alerts: true,
  abcac_announcements: true,
  icrc_updates: false,
};

describe("setMemberNotificationPrefs", () => {
  it("rejects a missing member id", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await setMemberNotificationPrefs("", PREFS)).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await setMemberNotificationPrefs("m1", PREFS)).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await setMemberNotificationPrefs("m1", PREFS)).toEqual({ ok: false, error: "forbidden" });
    expect(adminRef.current!.calls).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("admin: upserts the four booleans on member_id, audits, revalidates", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    const res = await setMemberNotificationPrefs("m1", PREFS);
    expect(res).toEqual({ ok: true });

    const up = adminRef.current!.callsFor("notification_preferences", "upsert")[0];
    expect(up.payload).toMatchObject({
      member_id: "m1",
      renewal_reminders: false,
      ceu_deadline_alerts: true,
      abcac_announcements: true,
      icrc_updates: false,
    });
    expect((up.payload as { updated_at?: string }).updated_at).toBeTruthy();
    expect(up.options).toEqual({ onConflict: "member_id" });

    const audit = adminRef.current!.callsFor("admin_audit_log", "insert")[0];
    expect(audit.payload).toMatchObject({
      admin_id: "admin1",
      action: "notification_prefs_overridden",
      details: { member_id: "m1", renewal_reminders: false },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/members/m1");
  });

  it("coerces undefined toggles to strict false (never NULL)", async () => {
    setup({ user: { id: "admin1" }, callerRole: "admin" });
    // @ts-expect-error intentionally passing a partial object
    await setMemberNotificationPrefs("m1", { renewal_reminders: true });
    const up = adminRef.current!.callsFor("notification_preferences", "upsert")[0];
    expect(up.payload).toMatchObject({
      renewal_reminders: true,
      ceu_deadline_alerts: false,
      abcac_announcements: false,
      icrc_updates: false,
    });
  });

  it("surfaces an upsert error", async () => {
    const adminResult: ResultFor = (table, op) =>
      table === "notification_preferences" && op === "upsert"
        ? { error: { message: "nope" } }
        : { data: null };
    setup({ user: { id: "admin1" }, callerRole: "admin", adminResult });
    expect(await setMemberNotificationPrefs("m1", PREFS)).toEqual({ ok: false, error: "nope" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
