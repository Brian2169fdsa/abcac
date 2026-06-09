// Runner delivery + dedupe. We mock the email helper and feed the runner a
// chainable fake Supabase admin client whose `reminder_log` insert can be made
// to succeed (deliver) or return a unique-violation error (skip / dedupe).

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const sendEmail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

import { runRemindersForMembers, runRemindersForAll } from "@/lib/reminders-runner";

// ── Fake admin client ──────────────────────────────────────────────────────
// The runner reads several tables via `.from(t).select(...).eq(...)...` chains
// (terminating in `maybeSingle()` or being awaited as a thenable) and writes
// via `.from(t).insert(...)`. We build a thenable query builder that ignores
// the filter calls and resolves to per-table canned rows, and we record every
// insert. `reminder_log` inserts return whatever `claimResult` yields.

type Rows = Record<string, unknown[]>;

interface FakeOptions {
  rows: Rows;
  // Called per reminder_log insert; return an error to simulate dedupe.
  claim: (call: number) => { error: unknown };
}

function makeFake(opts: FakeOptions) {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];
  let claimCalls = 0;

  function builder(table: string) {
    const result = { data: opts.rows[table] ?? [], error: null };
    const chain: Record<string, unknown> = {};
    // Filter/selector methods just return the chain so calls compose.
    for (const m of ["select", "eq", "not", "in", "order", "limit"]) {
      chain[m] = () => chain;
    }
    // Single-row terminals: pick the first canned row (or null).
    chain.maybeSingle = async () => ({ data: (opts.rows[table] ?? [])[0] ?? null, error: null });
    chain.single = chain.maybeSingle;
    // Awaiting the chain itself (e.g. multi-row select) resolves to the rows.
    chain.then = (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve);
    return chain;
  }

  const client = {
    from(table: string) {
      const b = builder(table);
      return {
        ...b,
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          if (table === "reminder_log") {
            return Promise.resolve(opts.claim(claimCalls++));
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, inserts, getClaimCalls: () => claimCalls };
}

// One member with a single task due tomorrow → exactly one `task_due` reminder.
const TASK = { id: "t1", title: "Sign form", due_date: dayFromNow(1), status: "open", visible_to_member: true };
function dayFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

function rowsForOneTaskMember(email: string | null): Rows {
  return {
    profiles: [{ id: "m1", email, first_name: "Sam" }],
    notification_preferences: [{ renewal_reminders: true, ceu_deadline_alerts: true }],
    certifications: [],
    ceu_records: [],
    document_requests: [],
    member_tasks: [TASK],
    cert_schedules: [],
  };
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  delete process.env.RESEND_API_KEY;
});

describe("runner — successful delivery", () => {
  it("claims the reminder, writes a portal message, and emails", async () => {
    sendEmail.mockResolvedValue(true);
    const { client, inserts } = makeFake({
      rows: rowsForOneTaskMember("sam@example.com"),
      claim: () => ({ error: null }),
    });

    const summary = await runRemindersForMembers(client, ["m1"]);

    expect(summary).toEqual({ membersProcessed: 1, remindersSent: 1, emailsSent: 1 });

    const logInserts = inserts.filter((i) => i.table === "reminder_log");
    const msgInserts = inserts.filter((i) => i.table === "messages");
    expect(logInserts).toHaveLength(1);
    expect(msgInserts).toHaveLength(1);
    expect(logInserts[0].payload.reminder_type).toBe("task_due");
    expect(logInserts[0].payload.member_id).toBe("m1");
    expect(msgInserts[0].payload.member_id).toBe("m1");
    expect(msgInserts[0].payload.from_name).toBe("ABCAC");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "sam@example.com", subject: expect.any(String), html: expect.any(String) }),
    );
  });
});

describe("runner — dedupe (claim fails)", () => {
  it("skips the portal message and the email when the log insert errors", async () => {
    const { client, inserts } = makeFake({
      rows: rowsForOneTaskMember("sam@example.com"),
      // Simulate UNIQUE violation (already sent).
      claim: () => ({ error: { code: "23505", message: "duplicate key value violates unique constraint" } }),
    });

    const summary = await runRemindersForMembers(client, ["m1"]);

    expect(summary).toEqual({ membersProcessed: 1, remindersSent: 0, emailsSent: 0 });
    // The claim was attempted...
    expect(inserts.filter((i) => i.table === "reminder_log")).toHaveLength(1);
    // ...but nothing was delivered.
    expect(inserts.filter((i) => i.table === "messages")).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("runner — email best-effort", () => {
  it("still records the reminder + writes the message when email is a no-op (RESEND unset → false)", async () => {
    sendEmail.mockResolvedValue(false); // mimics sendEmail with RESEND_API_KEY unset
    const { client, inserts } = makeFake({
      rows: rowsForOneTaskMember("sam@example.com"),
      claim: () => ({ error: null }),
    });

    const summary = await runRemindersForMembers(client, ["m1"]);

    // Reminder + portal message recorded; emailsSent stays 0; never throws.
    expect(summary).toEqual({ membersProcessed: 1, remindersSent: 1, emailsSent: 0 });
    expect(inserts.filter((i) => i.table === "messages")).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("delivers the portal message but skips email entirely when the member has no email", async () => {
    const { client, inserts } = makeFake({
      rows: rowsForOneTaskMember(null),
      claim: () => ({ error: null }),
    });

    const summary = await runRemindersForMembers(client, ["m1"]);

    expect(summary).toEqual({ membersProcessed: 1, remindersSent: 1, emailsSent: 0 });
    expect(inserts.filter((i) => i.table === "messages")).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("runner — sentBy provenance", () => {
  it("passes the admin id through to reminder_log.sent_by on a manual run", async () => {
    const { client, inserts } = makeFake({
      rows: rowsForOneTaskMember("sam@example.com"),
      claim: () => ({ error: null }),
    });

    await runRemindersForMembers(client, ["m1"], "admin-123");

    const log = inserts.find((i) => i.table === "reminder_log");
    expect(log?.payload.sent_by).toBe("admin-123");
  });

  it("records null sent_by on a cron run (runRemindersForAll)", async () => {
    // collectMemberIds reads certifications/document_requests/member_tasks for
    // member ids; reuse the task member so exactly one reminder fires.
    const rows = rowsForOneTaskMember("sam@example.com");
    rows.member_tasks = [{ member_id: "m1", ...TASK }];
    const { client, inserts } = makeFake({ rows, claim: () => ({ error: null }) });

    const summary = await runRemindersForAll(client);

    expect(summary.membersProcessed).toBe(1);
    const log = inserts.find((i) => i.table === "reminder_log");
    expect(log?.payload.sent_by).toBeNull();
  });
});
