import { describe, it, expect } from "vitest";
import { computeReminders, daysUntil, type ReminderContext } from "@/lib/reminders";

const TODAY = new Date("2026-06-08T12:00:00Z");

function iso(daysFromToday: number): string {
  return new Date(TODAY.getTime() + daysFromToday * 86_400_000).toISOString().slice(0, 10);
}

function ctx(over: Partial<ReminderContext> = {}): ReminderContext {
  return {
    today: TODAY,
    firstName: "Sam",
    certs: [],
    openDocRequests: [],
    tasks: [],
    prefs: { renewalReminders: true, ceuDeadlineAlerts: true },
    ...over,
  };
}

describe("daysUntil", () => {
  it("is positive for future, negative for past", () => {
    expect(daysUntil(TODAY, iso(30))).toBe(30);
    expect(daysUntil(TODAY, iso(-5))).toBe(-5);
  });
});

describe("renewal reminders", () => {
  it("emits only the smallest crossed tier", () => {
    const r = computeReminders(ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(25), status: "active" }] }));
    const renewals = r.filter((x) => x.type.startsWith("renewal_"));
    expect(renewals).toHaveLength(1);
    expect(renewals[0].type).toBe("renewal_30");
    expect(renewals[0].dedupeKey).toBe("renewal:c1:30");
  });

  it("uses the 90 tier when ~85 days out", () => {
    const r = computeReminders(ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(85), status: "active" }] }));
    expect(r.find((x) => x.type.startsWith("renewal_"))?.type).toBe("renewal_90");
  });

  it("does not fire beyond 90 days", () => {
    const r = computeReminders(ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(120), status: "active" }] }));
    expect(r.some((x) => x.type.startsWith("renewal_"))).toBe(false);
  });

  it("respects the renewal_reminders preference", () => {
    const r = computeReminders(
      ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(20), status: "active" }], prefs: { renewalReminders: false, ceuDeadlineAlerts: true } }),
    );
    expect(r.some((x) => x.type.startsWith("renewal_"))).toBe(false);
  });

  it("ignores inactive certs", () => {
    const r = computeReminders(ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(20), status: "expired" }] }));
    expect(r).toHaveLength(0);
  });
});

describe("CEU shortfall", () => {
  it("fires within 60 days when CEUs are unmet", () => {
    const r = computeReminders(ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(45), status: "active", ceuMet: false }] }));
    expect(r.some((x) => x.type === "ceu_shortfall")).toBe(true);
  });

  it("does not fire when CEUs are met", () => {
    const r = computeReminders(ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(45), status: "active", ceuMet: true }] }));
    expect(r.some((x) => x.type === "ceu_shortfall")).toBe(false);
  });

  it("respects the ceu_deadline_alerts preference", () => {
    const r = computeReminders(
      ctx({ certs: [{ id: "c1", certType: "CADC", expiration: iso(45), status: "active", ceuMet: false }], prefs: { renewalReminders: true, ceuDeadlineAlerts: false } }),
    );
    expect(r.some((x) => x.type === "ceu_shortfall")).toBe(false);
  });
});

describe("document request nudges", () => {
  it("fires for requests older than 7 days", () => {
    const r = computeReminders(ctx({ openDocRequests: [{ id: "d1", documentType: "Transcript", createdAt: iso(-10) }] }));
    expect(r.some((x) => x.type === "doc_request")).toBe(true);
  });

  it("stays quiet for fresh requests", () => {
    const r = computeReminders(ctx({ openDocRequests: [{ id: "d1", documentType: "Transcript", createdAt: iso(-2) }] }));
    expect(r.some((x) => x.type === "doc_request")).toBe(false);
  });
});

describe("task reminders", () => {
  it("fires for a visible task due soon", () => {
    const r = computeReminders(ctx({ tasks: [{ id: "t1", title: "Sign form", dueDate: iso(2), status: "open", visibleToMember: true }] }));
    const t = r.find((x) => x.type === "task_due");
    expect(t?.dedupeKey).toBe(`task:t1:${iso(2)}`);
  });

  it("ignores hidden tasks", () => {
    const r = computeReminders(ctx({ tasks: [{ id: "t1", title: "Internal", dueDate: iso(1), status: "open", visibleToMember: false }] }));
    expect(r.some((x) => x.type === "task_due")).toBe(false);
  });

  it("ignores done/cancelled and far-future tasks", () => {
    const r = computeReminders(
      ctx({
        tasks: [
          { id: "t1", title: "Done", dueDate: iso(1), status: "done", visibleToMember: true },
          { id: "t2", title: "Later", dueDate: iso(30), status: "open", visibleToMember: true },
        ],
      }),
    );
    expect(r.some((x) => x.type === "task_due")).toBe(false);
  });

  it("fires for overdue tasks", () => {
    const r = computeReminders(ctx({ tasks: [{ id: "t1", title: "Late", dueDate: iso(-3), status: "in_progress", visibleToMember: true }] }));
    expect(r.some((x) => x.type === "task_due")).toBe(true);
  });
});
