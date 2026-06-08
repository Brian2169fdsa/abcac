import { describe, it, expect } from "vitest";
import {
  getPlanningTools,
  buildPlan,
  missingInitialDocs,
  summarizeDocuments,
  composeDraftMessage,
  type CertRow,
  type DocRow,
  type ApplicationRow,
} from "@/lib/assistant/planning-tools";
import type { CeuLike } from "@/lib/ceu-compliance";
import type { CertSchedule } from "@/lib/schedules";

const schedule: CertSchedule = {
  credential_type: "CAC",
  renewal_cycle_months: 24,
  ceu_total_required: 40,
  ceu_ethics_required: 3,
  ceu_cultural_required: 3,
  grace_period_days: 30,
};

const approved = (hours: number, category: string): CeuLike => ({
  hours,
  category,
  status: "approved",
});

describe("planning tool definitions", () => {
  const tools = getPlanningTools();

  it("exposes exactly the three planning tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "create_plan",
      "draft_message",
      "summarize_member_status",
    ]);
  });

  it("describes every tool as read-only / draft-only (never writes)", () => {
    for (const t of tools) {
      expect(t.description.toLowerCase()).toMatch(/read-only|planning only|drafting only|never sends|no writes/);
    }
  });
});

describe("summarizeDocuments", () => {
  it("counts documents by status", () => {
    const docs: DocRow[] = [
      { document_type: "application", status: "approved" },
      { document_type: "transcript", status: "pending" },
      { document_type: "old", status: "rejected" },
      { document_type: "x", status: "PENDING" }, // case-insensitive
    ];
    expect(summarizeDocuments(docs)).toEqual({
      total: 4,
      approved: 1,
      pending: 2,
      rejected: 1,
    });
  });
});

describe("missingInitialDocs", () => {
  it("flags required docs that are absent", () => {
    const docs: DocRow[] = [{ document_type: "Application Form", status: "approved" }];
    const missing = missingInitialDocs(docs);
    expect(missing).not.toContain("application");
    expect(missing).toContain("transcript");
    expect(missing).toContain("supervision");
    expect(missing).toContain("background_check");
  });

  it("treats a rejected document as still missing", () => {
    const docs: DocRow[] = [{ document_type: "transcript", status: "rejected" }];
    expect(missingInitialDocs(docs)).toContain("transcript");
  });

  it("returns empty when all required docs are present", () => {
    const docs: DocRow[] = [
      { document_type: "application", status: "approved" },
      { document_type: "official transcript", status: "approved" },
      { document_type: "supervision hours log", status: "pending" },
      { document_type: "background check", status: "approved" },
    ];
    expect(missingInitialDocs(docs)).toEqual([]);
  });
});

describe("buildPlan — initial certification", () => {
  it("orders steps application → documents → exam and flags a missing app", () => {
    const plan = buildPlan({
      memberId: "m1",
      goal: "initial certification",
      certs: [],
      ceus: [],
      docs: [],
      applications: [],
      asOf: "2026-01-01",
    });
    expect(plan.draft_only).toBe(true);
    expect(plan.member_id).toBe("m1");
    // First step is the application, last is the exam.
    expect(plan.steps[0].category).toBe("application");
    expect(plan.steps[plan.steps.length - 1].category).toBe("exam");
    // Steps are sequentially numbered from 1.
    plan.steps.forEach((s, i) => expect(s.order).toBe(i + 1));
    // All four required docs surface as document steps.
    const docSteps = plan.steps.filter((s) => s.category === "documents");
    expect(docSteps.length).toBe(4);
  });

  it("does not add an application step when one is already open", () => {
    const applications: ApplicationRow[] = [
      { app_type: "initial", cert_type: "CAC", status: "submitted" },
    ];
    const plan = buildPlan({
      memberId: "m1",
      goal: "initial certification",
      certs: [],
      ceus: [],
      docs: [
        { document_type: "application", status: "approved" },
        { document_type: "transcript", status: "approved" },
        { document_type: "supervision", status: "approved" },
        { document_type: "background_check", status: "approved" },
      ],
      applications,
      asOf: "2026-01-01",
    });
    expect(plan.steps.some((s) => s.category === "application")).toBe(false);
  });

  it("derives due dates spaced forward from asOf", () => {
    const plan = buildPlan({
      memberId: "m1",
      goal: "initial certification",
      certs: [],
      ceus: [],
      docs: [],
      applications: [],
      asOf: "2026-01-01",
    });
    // Each step's due date should be strictly after asOf and non-decreasing.
    let prev = "2026-01-01";
    for (const s of plan.steps) {
      expect(s.due_date).not.toBeNull();
      expect(s.due_date! > prev).toBe(true);
      prev = s.due_date!;
    }
  });
});

describe("buildPlan — renewal", () => {
  it("adds CEU shortfall steps (total, ethics, cultural) before renewal", () => {
    const plan = buildPlan({
      memberId: "m2",
      goal: "renewal",
      certs: [{ cert_type: "CAC", status: "active", expiration_date: "2026-12-31" }],
      ceus: [approved(10, "General")], // 10/40, 0 ethics, 0 cultural
      docs: [],
      applications: [],
      schedule,
      asOf: "2026-01-01",
    });
    const categories = plan.steps.map((s) => s.category);
    // CEU steps come first, renewal last.
    expect(categories.filter((c) => c === "ceu").length).toBe(3);
    expect(categories[categories.length - 1]).toBe("renewal");
    // Shortfall reflected in titles.
    expect(plan.steps[0].title).toContain("30"); // 40 - 10 remaining
  });

  it("anchors the renewal step to the credential expiration date", () => {
    const plan = buildPlan({
      memberId: "m2",
      goal: "renewal",
      certs: [{ cert_type: "CAC", status: "active", expiration_date: "2026-12-31" }],
      ceus: [],
      docs: [],
      applications: [],
      schedule,
      asOf: "2026-01-01",
    });
    const renewal = plan.steps.find((s) => s.category === "renewal");
    expect(renewal?.due_date).toBe("2026-12-31");
  });

  it("back-dates CEU due dates to 30 days before the renewal date", () => {
    const plan = buildPlan({
      memberId: "m2",
      goal: "renewal",
      certs: [{ cert_type: "CAC", status: "active", expiration_date: "2026-12-31" }],
      ceus: [approved(10, "General")],
      docs: [],
      applications: [],
      schedule,
      asOf: "2026-01-01",
    });
    const ceuStep = plan.steps.find((s) => s.category === "ceu");
    expect(ceuStep?.due_date).toBe("2026-12-01"); // 30 days before 12-31
  });

  it("emits only the renewal step (and a note) when CEUs are already satisfied", () => {
    const certs: CertRow[] = [
      { cert_type: "CAC", status: "active", expiration_date: "2026-12-31" },
    ];
    const ceus: CeuLike[] = [
      approved(40, "General"),
      approved(3, "Ethics"),
      approved(3, "Cultural Diversity"),
    ];
    const plan = buildPlan({
      memberId: "m2",
      goal: "renewal",
      certs,
      ceus,
      docs: [],
      applications: [],
      schedule,
      asOf: "2026-01-01",
    });
    expect(plan.steps.length).toBe(1);
    expect(plan.steps[0].category).toBe("renewal");
    expect(plan.note).toBeTruthy();
  });
});

describe("composeDraftMessage", () => {
  it("addresses the member and includes the brief but never claims to send", () => {
    const draft = composeDraftMessage({ memberName: "Jane Doe", brief: "Your renewal is due soon." });
    expect(draft).toContain("Dear Jane Doe,");
    expect(draft).toContain("Your renewal is due soon.");
    expect(draft).toContain("ABCAC");
  });

  it("falls back to 'Member' when no name is given", () => {
    const draft = composeDraftMessage({ brief: "Hello." });
    expect(draft).toContain("Dear Member,");
  });

  it("weaves in numbered plan steps with dates when provided", () => {
    const plan = buildPlan({
      memberId: "m2",
      goal: "renewal",
      certs: [{ cert_type: "CAC", status: "active", expiration_date: "2026-12-31" }],
      ceus: [approved(10, "General")],
      docs: [],
      applications: [],
      schedule,
      asOf: "2026-01-01",
    });
    const draft = composeDraftMessage({ memberName: "Jane", brief: "Action needed.", steps: plan.steps });
    expect(draft).toContain("Your next steps:");
    expect(draft).toMatch(/1\. /);
    expect(draft).toContain("2026-12-31");
  });
});
