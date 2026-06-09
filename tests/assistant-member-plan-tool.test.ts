import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMemberTools,
  getMemberExecutors,
  formatPlanSteps,
} from "@/lib/assistant/member-tools";
import type { PlanStep } from "@/lib/member-plan";

/**
 * Sample rows the fake member RLS client returns. These describe a member with a
 * partly-filled profile, an active CAC credential expiring soon, a CEU shortfall,
 * and one outstanding document request — enough to exercise every plan step.
 */
const SAMPLE = {
  profiles: {
    first_name: "Jane",
    last_name: "Doe",
    phone: "555-0100",
    address_line1: null,
    city: "Phoenix",
    state: "AZ",
    zip_code: null,
  },
  certifications: [
    { cert_type: "CAC", status: "active", expiration_date: "2026-07-01" },
  ],
  ceu_records: [
    { hours: 10, category: "General", status: "approved" },
  ],
  applications: [{ status: "approved", submitted_at: "2025-01-01" }],
  cert_schedules: [
    {
      credential_type: "CAC",
      renewal_cycle_months: 24,
      ceu_total_required: 40,
      ceu_ethics_required: 3,
      ceu_cultural_required: 3,
      grace_period_days: 30,
      notes: null,
    },
  ],
  /** document_requests open count returned via { count } head queries. */
  openDocCount: 2,
};

/**
 * A minimal Supabase query-builder stub. Each `.from(table)` returns a thenable
 * builder whose chained filters are no-ops; awaiting it (or calling maybeSingle)
 * resolves with the canned rows for that table. `head:true` count queries on
 * document_requests resolve to a `count`. It records every table read so the
 * test can assert the executor only READS (never insert/update/delete).
 */
function makeFakeClient(): { sb: SupabaseClient; writes: string[]; reads: string[] } {
  const writes: string[] = [];
  const reads: string[] = [];

  function builder(table: string, opts?: { head?: boolean }) {
    let head = opts?.head ?? false;
    const resolve = () => {
      if (table === "profiles") return { data: SAMPLE.profiles, error: null };
      if (table === "certifications") return { data: SAMPLE.certifications, error: null };
      if (table === "ceu_records") return { data: SAMPLE.ceu_records, error: null };
      if (table === "applications") return { data: SAMPLE.applications, error: null };
      if (table === "cert_schedules") return { data: SAMPLE.cert_schedules, error: null };
      if (table === "document_requests") {
        return head
          ? { data: null, count: SAMPLE.openDocCount, error: null }
          : { data: [], error: null };
      }
      return { data: [], error: null };
    };

    const api: Record<string, unknown> = {
      select(_cols?: string, selectOpts?: { head?: boolean; count?: string }) {
        if (selectOpts?.head) head = true;
        return api;
      },
      eq() {
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      maybeSingle() {
        return Promise.resolve(resolve());
      },
      // Any write path is forbidden for this read-only tool; record + reject.
      insert() {
        writes.push(`insert:${table}`);
        return Promise.resolve({ error: { message: "writes are forbidden" } });
      },
      update() {
        writes.push(`update:${table}`);
        return Promise.resolve({ error: { message: "writes are forbidden" } });
      },
      delete() {
        writes.push(`delete:${table}`);
        return Promise.resolve({ error: { message: "writes are forbidden" } });
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(resolve()).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  const sb = {
    from(table: string) {
      reads.push(table);
      return builder(table);
    },
  } as unknown as SupabaseClient;

  return { sb, writes, reads };
}

describe("create_my_plan tool definition", () => {
  const tools = getMemberTools();
  const tool = tools.find((t) => t.name === "create_my_plan");

  it("is registered in the member toolset", () => {
    expect(tool).toBeDefined();
  });

  it("is described as read-only and takes no member-supplied arguments", () => {
    expect(tool!.description.toLowerCase()).toMatch(/read-only/);
    expect(tool!.description.toLowerCase()).toMatch(/does not write|never writes?/);
    expect(tool!.input_schema.properties ?? {}).toEqual({});
  });

  it("is wired into the executor map", () => {
    const { sb } = makeFakeClient();
    const executors = getMemberExecutors({ sb, uid: "member-1" });
    expect(typeof executors.create_my_plan).toBe("function");
  });
});

describe("create_my_plan executor", () => {
  it("assembles the member's data and returns ordered, numbered steps", async () => {
    const { sb, writes, reads } = makeFakeClient();
    const executors = getMemberExecutors({ sb, uid: "member-1" });

    const result = await executors.create_my_plan({});

    // Reads the member's own profile, certs, CEUs, applications, doc requests.
    expect(reads).toEqual(
      expect.arrayContaining([
        "profiles",
        "certifications",
        "ceu_records",
        "applications",
        "document_requests",
      ]),
    );

    // Read-only: never touches an insert/update/delete path.
    expect(writes).toEqual([]);

    // Ordered, numbered checklist text.
    expect(result).toContain("1.");
    expect(result).toContain("2.");
    expect(result).toContain("Status:");
    // Profile is incomplete (missing address/zip) → that step surfaces.
    expect(result).toContain("Complete your profile");
    // Active credential with a CEU shortfall (10/40) → CEU step surfaces.
    expect(result).toMatch(/CEU/i);
    // Renewal step carries the credential's due date.
    expect(result).toContain("2026-07-01");
    expect(result).toContain("Due:");
  });
});

describe("formatPlanSteps", () => {
  const steps: PlanStep[] = [
    {
      id: "complete-profile",
      title: "Complete your profile",
      detail: "Your profile is 70% complete.",
      status: "in_progress",
      href: "/account/profile",
      priority: "high",
    },
    {
      id: "renew-certification",
      title: "Renew your certification",
      detail: "Your credential expires soon.",
      dueDate: "2026-07-01",
      status: "todo",
      href: "/account/renew",
      priority: "high",
    },
  ];

  it("numbers steps in order and includes title, detail, due date, and status", () => {
    const text = formatPlanSteps(steps);
    expect(text).toContain("1. Complete your profile — Your profile is 70% complete.");
    expect(text).toContain("2. Renew your certification");
    expect(text).toContain("Due: 2026-07-01.");
    expect(text).toContain("Status: To do.");
    expect(text).toContain("Status: In progress.");
    // Ordering: step 1 appears before step 2.
    expect(text.indexOf("1.")).toBeLessThan(text.indexOf("2."));
  });

  it("returns an all-caught-up message when there are no steps", () => {
    expect(formatPlanSteps([])).toMatch(/all caught up/i);
  });
});
