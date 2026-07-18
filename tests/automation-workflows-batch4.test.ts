// Batch 4 — final deterministic workflows: cert_sync (rule + enable_cert_sync
// executor + sweep) and the reminders audit bridge (recordReminderRun).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type FakeClient, type Op, type QueryResult } from "./helpers/supabase-fake";

let active: FakeClient;
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => active.client,
}));
const dispatchMock = vi.fn(async () => ({ status: "auto_executed" as const }));
vi.mock("@/lib/automation/dispatch", () => ({
  dispatch: (...a: unknown[]) => dispatchMock(...(a as [])),
}));

import { certSyncRule, CERT_SYNC_RULE_VERSION } from "@/lib/automation/workflows/cert-sync";
import { REGISTRY } from "@/lib/automation/registry";
import { sweepCertSync, runAutomationSweep } from "@/lib/automation/sweep";
import { recordReminderRun, REMINDERS_RULE_VERSION } from "@/lib/automation/reminders-bridge";

function client(map: (t: string, op: Op) => QueryResult): FakeClient {
  return makeClient({ id: "admin" }, map);
}

const APP = { id: "app-1", member_id: "m1", app_type: "cert_sync", status: "submitted" };
const CERTS = [
  { id: "c-1", sync_enabled: false },
  { id: "c-2", sync_enabled: true },
];

/**
 * certSyncRule queries `applications` twice (the entity row, then the member's
 * pending cert_sync applications), so the fake needs a call counter to give the
 * maybeSingle row first and the pending list second.
 */
function ruleClient(opts: {
  app?: Record<string, unknown> | null;
  certs?: Record<string, unknown>[];
  pending?: Record<string, unknown>[];
}): FakeClient {
  let appCalls = 0;
  return client((t) => {
    if (t === "applications") return appCalls++ === 0 ? { data: opts.app ?? null } : { data: opts.pending ?? [{ id: "app-1" }] };
    if (t === "certifications") return { data: opts.certs ?? [] };
    return { data: null };
  });
}

// ── cert_sync rule ────────────────────────────────────────────────────────────
describe("certSyncRule", () => {
  const INPUT = { workflow: "cert_sync", entityType: "application", entityId: "app-1" };

  it("returns null for missing / memberless / wrong-type / non-pending applications", async () => {
    expect(await certSyncRule(ruleClient({ app: null }).client, INPUT)).toBeNull();
    expect(await certSyncRule(ruleClient({ app: { ...APP, member_id: null } }).client, INPUT)).toBeNull();
    expect(await certSyncRule(ruleClient({ app: { ...APP, app_type: "renewal" } }).client, INPUT)).toBeNull();
    expect(await certSyncRule(ruleClient({ app: APP }).client, INPUT)).toBeNull();
    expect(await certSyncRule(ruleClient({ app: { ...APP, status: "approved" } }).client, INPUT)).toBeNull();
    expect(await certSyncRule(ruleClient({ app: APP }).client, { ...INPUT, entityId: undefined })).toBeNull();
  });

  it("decisively escalates when the member has no certifications (nothing to sync)", async () => {
    const r = await certSyncRule(ruleClient({ app: { ...APP, status: "under_review" }, certs: [] }).client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(r?.anomalies).toContain("no_certifications");
    expect(String(r?.summary)).toContain("nothing to sync");
    expect(r?.ruleVersion).toBe(CERT_SYNC_RULE_VERSION);
  });

  it("escalates with an anomaly flag when the member has multiple pending cert_sync apps", async () => {
    const r = await certSyncRule(
      ruleClient({
        app: { ...APP, status: "under_review" },
        certs: CERTS,
        pending: [{ id: "app-1" }, { id: "app-2" }],
      }).client,
      INPUT,
    );
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("escalate");
    expect(r?.action).toBeUndefined();
    expect(r?.anomalies).toContain("multiple_pending_cert_sync");
    expect(String(r?.summary)).toContain("app-2");
  });

  it("happy path: stages enable_cert_sync (auto) targeting this application and member", async () => {
    const r = await certSyncRule(ruleClient({ app: { ...APP, status: "under_review" }, certs: CERTS }).client, INPUT);
    expect(r?.decisive).toBe(true);
    expect(r?.tier).toBe("auto");
    expect(r?.ruleVersion).toBe(CERT_SYNC_RULE_VERSION);
    expect(r?.action?.handler).toBe("enable_cert_sync");
    expect(r?.action?.args).toMatchObject({ applicationId: "app-1", memberId: "m1", expectStatus: "under_review" });
    expect(String(r?.summary)).toContain("1 of 2 certification(s)");
  });
});

// ── enable_cert_sync executor ─────────────────────────────────────────────────
describe("enable_cert_sync executor", () => {
  function execClient(opts: { app?: Record<string, unknown> | null; certs?: Record<string, unknown>[] }): FakeClient {
    return client((t, op) => {
      if (t === "applications" && op === "select") return { data: opts.app ?? null };
      if (t === "certifications" && op === "select") return { data: opts.certs ?? [] };
      return { data: null };
    });
  }

  it("rejects missing id, unknown application, and non-cert_sync applications", async () => {
    expect((await REGISTRY.enable_cert_sync(execClient({}).client, {})).error).toBe("bad_args");
    expect(await REGISTRY.enable_cert_sync(execClient({ app: null }).client, { applicationId: "app-x" })).toMatchObject({
      ok: false,
      error: "not_found",
    });
    expect(
      await REGISTRY.enable_cert_sync(execClient({ app: { ...APP, app_type: "renewal" } }).client, { applicationId: "app-1" }),
    ).toMatchObject({ ok: false, error: "bad_state" });
  });

  it("performs BOTH writes: flips sync only on still-off certs, then approves the application", async () => {
    const c = execClient({ app: APP, certs: CERTS });
    const res = await REGISTRY.enable_cert_sync(c.client, { applicationId: "app-1", memberId: "m1", expectStatus: "submitted" });
    expect(res.ok).toBe(true);
    expect(res.after).toMatchObject({ applicationId: "app-1", status: "approved", syncEnabledCertIds: ["c-1"] });

    const certUpd = c.callsFor("certifications", "update")[0];
    expect(certUpd.payload).toEqual({ sync_enabled: true });
    expect(certUpd.filters).toContainEqual({ col: "member_id", val: "m1" });
    // idempotency: the write only touches rows where sync is still off
    expect(certUpd.filters).toContainEqual({ col: "sync_enabled", val: false });

    const appUpd = c.callsFor("applications", "update")[0];
    expect(appUpd.payload).toMatchObject({ status: "approved" });
    expect((appUpd.payload as { reviewed_at?: string }).reviewed_at).toBeTruthy();
    expect(appUpd.filters).toContainEqual({ col: "id", val: "app-1" });
    // race guard: the approval is conditioned on the status it re-validated
    expect(appUpd.filters).toContainEqual({ col: "status", val: "submitted" });
  });

  it("skips the cert write (but still approves) when every cert already has sync on", async () => {
    const c = execClient({ app: APP, certs: [{ id: "c-1", sync_enabled: true }] });
    const res = await REGISTRY.enable_cert_sync(c.client, { applicationId: "app-1" });
    expect(res.ok).toBe(true);
    expect(res.after).toMatchObject({ syncEnabledCertIds: [] });
    expect(c.callsFor("certifications", "update")).toHaveLength(0);
    expect(c.callsFor("applications", "update")).toHaveLength(1);
  });

  it("is idempotent: an already-approved application is an ok no-op (no writes)", async () => {
    const c = execClient({ app: { ...APP, status: "approved" } });
    const res = await REGISTRY.enable_cert_sync(c.client, { applicationId: "app-1", expectStatus: "submitted" });
    expect(res.ok).toBe(true);
    expect(res.after).toMatchObject({ applicationId: "app-1", status: "approved" });
    expect(c.callsFor("certifications", "update")).toHaveLength(0);
    expect(c.callsFor("applications", "update")).toHaveLength(0);
  });

  it("refuses when a human moved the application (state_moved), with no writes", async () => {
    for (const status of ["rejected", "withdrawn"]) {
      const c = execClient({ app: { ...APP, status }, certs: CERTS });
      const res = await REGISTRY.enable_cert_sync(c.client, { applicationId: "app-1", expectStatus: "submitted" });
      expect(res).toMatchObject({ ok: false, error: "state_moved" });
      expect(c.callsFor("certifications", "update")).toHaveLength(0);
      expect(c.callsFor("applications", "update")).toHaveLength(0);
    }
    // expectStatus mismatch between two still-pending states is also a move
    const c = execClient({ app: { ...APP, status: "under_review" }, certs: CERTS });
    const res = await REGISTRY.enable_cert_sync(c.client, { applicationId: "app-1", expectStatus: "submitted" });
    expect(res).toMatchObject({ ok: false, error: "state_moved" });
  });

  it("fails closed when the member has no certifications at execute time", async () => {
    const c = execClient({ app: APP, certs: [] });
    const res = await REGISTRY.enable_cert_sync(c.client, { applicationId: "app-1" });
    expect(res).toMatchObject({ ok: false, error: "no_certifications" });
    expect(c.callsFor("applications", "update")).toHaveLength(0);
  });
});

// ── cert_sync sweep ───────────────────────────────────────────────────────────
describe("sweepCertSync", () => {
  beforeEach(() => dispatchMock.mockClear());

  it("dispatches pending cert_sync applications and skips memberless rows", async () => {
    active = client((t) => {
      if (t === "applications")
        return {
          data: [
            { id: "app-1", member_id: "m1", app_type: "cert_sync", status: "submitted" },
            { id: "app-2", member_id: null, app_type: "cert_sync", status: "submitted" },
          ],
        };
      if (t === "automation_runs") return { data: null };
      return { data: null };
    });
    expect(await sweepCertSync(active.client)).toEqual({ scanned: 2, dispatched: 1 });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ workflow: "cert_sync", entityType: "application", entityId: "app-1", memberId: "m1" }),
    );
  });

  it("dedups applications that already have a cert_sync run", async () => {
    active = client((t) => {
      if (t === "applications") return { data: [{ id: "app-1", member_id: "m1", app_type: "cert_sync", status: "submitted" }] };
      // Batched dedup query returns the entity_ids that already have a run.
      if (t === "automation_runs") return { data: [{ entity_id: "app-1" }] }; // already processed
      return { data: null };
    });
    expect(await sweepCertSync(active.client)).toEqual({ scanned: 1, dispatched: 0 });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it("runAutomationSweep gates cert_sync on its enabled flag (reminders has no sweep)", async () => {
    active = client((t) => {
      if (t === "automation_global") return { data: { paused: false } };
      if (t === "automation_config") return { data: { enabled: false, auto_threshold: null, propose_threshold: null } };
      return { data: null };
    });
    const out = await runAutomationSweep();
    expect(out.cert_sync).toEqual({ skipped: "disabled" });
    expect(out.reminders).toBeUndefined(); // delivery stays with the legacy runner
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

// ── reminders bridge (recordReminderRun) ──────────────────────────────────────
describe("recordReminderRun", () => {
  const SENT = { memberId: "m1", type: "renewal_30", dedupeKey: "renewal:c-1:30", subject: "Your CAC expires in 12 days" };

  function bridgeClient(opts: { paused?: boolean; config?: Record<string, unknown> | null }): FakeClient {
    return client((t) => {
      if (t === "automation_global") return { data: { paused: opts.paused ?? false } };
      if (t === "automation_config") return { data: opts.config === undefined ? null : opts.config };
      return { data: null };
    });
  }

  it("writes an auto_executed run row when the reminders workflow is enabled", async () => {
    const c = bridgeClient({ config: { enabled: true, auto_threshold: null, propose_threshold: null } });
    await recordReminderRun(c.client, SENT);
    const inserts = c.callsFor("automation_runs", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toMatchObject({
      workflow: "reminders",
      entity_type: "reminder",
      entity_id: null,
      member_id: "m1",
      tier: "auto",
      status: "auto_executed",
      rule_version: REMINDERS_RULE_VERSION,
    });
    const payload = inserts[0].payload as { summary: string; resolved_at?: string };
    expect(payload.summary).toContain("renewal_30");
    expect(payload.summary).toContain("Your CAC expires in 12 days");
    expect(payload.summary).toContain("renewal:c-1:30");
    expect(payload.resolved_at).toBeTruthy();
  });

  it("no-ops while the workflow is disabled or unseeded (the shipped default)", async () => {
    const disabled = bridgeClient({ config: { enabled: false, auto_threshold: null, propose_threshold: null } });
    await recordReminderRun(disabled.client, SENT);
    expect(disabled.callsFor("automation_runs")).toHaveLength(0);

    const unseeded = bridgeClient({ config: null });
    await recordReminderRun(unseeded.client, SENT);
    expect(unseeded.callsFor("automation_runs")).toHaveLength(0);
  });

  it("honors the global pause even when the workflow is enabled", async () => {
    const c = bridgeClient({ paused: true, config: { enabled: true, auto_threshold: null, propose_threshold: null } });
    await recordReminderRun(c.client, SENT);
    expect(c.callsFor("automation_runs")).toHaveLength(0);
    // it short-circuits on the pause before even reading the workflow config
    expect(c.callsFor("automation_config")).toHaveLength(0);
  });

  it("never throws into the caller, even when every query blows up", async () => {
    const c = client(() => {
      throw new Error("db_down");
    });
    await expect(recordReminderRun(c.client, SENT)).resolves.toBeUndefined();

    const insertFails = client((t) => {
      if (t === "automation_global") return { data: { paused: false } };
      if (t === "automation_config") return { data: { enabled: true, auto_threshold: null, propose_threshold: null } };
      if (t === "automation_runs") throw new Error("insert_failed");
      return { data: null };
    });
    await expect(recordReminderRun(insertFails.client, SENT)).resolves.toBeUndefined();
  });
});
