import { describe, it, expect } from "vitest";
import {
  buildMemberPlan,
  isPlanComplete,
  type MemberPlanInput,
  type PlanCeuCompliance,
} from "@/lib/member-plan";

const compliantCeu: PlanCeuCompliance = {
  compliant: true,
  remaining: 0,
  requiredTotal: 40,
  totalApproved: 40,
};

const emptyCeu: PlanCeuCompliance = {
  compliant: false,
  remaining: 40,
  requiredTotal: 40,
  totalApproved: 0,
};

function base(overrides: Partial<MemberPlanInput> = {}): MemberPlanInput {
  return {
    profileCompleteness: 0,
    accountStatus: "none",
    certifications: [],
    ceuCompliance: emptyCeu,
    missingDocuments: 0,
    asOf: new Date("2026-06-08T00:00:00Z"),
    ...overrides,
  };
}

describe("buildMemberPlan ordering", () => {
  it("returns steps in the canonical certification order", () => {
    const steps = buildMemberPlan(
      base({
        profileCompleteness: 100,
        accountStatus: "active",
        certifications: [
          { cert_type: "CAC", status: "active", expiration_date: "2027-01-01" },
        ],
        ceuCompliance: emptyCeu,
        missingDocuments: 2,
      }),
    );
    expect(steps.map((s) => s.id)).toEqual([
      "complete-profile",
      "submit-application",
      "upload-documents",
      "earn-ceus",
      "renew-certification",
    ]);
  });

  it("omits CEU and renewal steps for a brand-new member with no active cert", () => {
    const steps = buildMemberPlan(base());
    expect(steps.map((s) => s.id)).toEqual([
      "complete-profile",
      "submit-application",
      "upload-documents",
    ]);
  });
});

describe("done vs todo detection", () => {
  it("marks profile done at 100% and todo at 0%", () => {
    const todo = buildMemberPlan(base({ profileCompleteness: 0 }));
    expect(todo[0].status).toBe("todo");

    const partial = buildMemberPlan(base({ profileCompleteness: 60 }));
    expect(partial[0].status).toBe("in_progress");

    const done = buildMemberPlan(base({ profileCompleteness: 100 }));
    expect(done[0].status).toBe("done");
  });

  it("marks the application step done when approved/active", () => {
    const submitted = buildMemberPlan(base({ accountStatus: "submitted" }));
    const appStep = submitted.find((s) => s.id === "submit-application")!;
    expect(appStep.status).toBe("in_progress");

    const approved = buildMemberPlan(base({ accountStatus: "approved" }));
    expect(approved.find((s) => s.id === "submit-application")!.status).toBe("done");
  });

  it("marks documents done only when none are missing", () => {
    const missing = buildMemberPlan(base({ missingDocuments: 3 }));
    const step = missing.find((s) => s.id === "upload-documents")!;
    expect(step.status).toBe("todo");
    expect(step.title).toContain("3 requested documents");
    expect(step.priority).toBe("high");

    const none = buildMemberPlan(base({ missingDocuments: 0 }));
    expect(none.find((s) => s.id === "upload-documents")!.status).toBe("done");
  });
});

describe("CEU shortfall step", () => {
  it("shows the remaining hours when an active cert is short on CEUs", () => {
    const steps = buildMemberPlan(
      base({
        certifications: [{ status: "active", expiration_date: "2028-01-01" }],
        ceuCompliance: { compliant: false, remaining: 12, requiredTotal: 40, totalApproved: 28 },
      }),
    );
    const ceu = steps.find((s) => s.id === "earn-ceus")!;
    expect(ceu.status).toBe("in_progress");
    expect(ceu.title).toContain("12 more CEU hours");
    expect(ceu.detail).toContain("28 of 40");
  });

  it("marks CEUs done when compliant", () => {
    const steps = buildMemberPlan(
      base({
        certifications: [{ status: "active", expiration_date: "2028-01-01" }],
        ceuCompliance: compliantCeu,
      }),
    );
    expect(steps.find((s) => s.id === "earn-ceus")!.status).toBe("done");
  });
});

describe("renewal-due step with dates", () => {
  it("flags an upcoming renewal within the window as high priority with a due date", () => {
    const steps = buildMemberPlan(
      base({
        certifications: [{ status: "active", expiration_date: "2026-07-01" }],
        ceuCompliance: compliantCeu,
      }),
    );
    const renew = steps.find((s) => s.id === "renew-certification")!;
    expect(renew.dueDate).toBe("2026-07-01");
    expect(renew.priority).toBe("high");
    expect(renew.detail).toContain("expires in");
  });

  it("flags a lapsed credential as overdue", () => {
    const steps = buildMemberPlan(
      base({
        certifications: [{ status: "active", expiration_date: "2026-01-01" }],
        ceuCompliance: compliantCeu,
      }),
    );
    const renew = steps.find((s) => s.id === "renew-certification")!;
    expect(renew.title).toContain("lapsed");
    expect(renew.priority).toBe("high");
    expect(renew.detail).toContain("lapsed");
  });

  it("uses the soonest expiration among multiple active certs", () => {
    const steps = buildMemberPlan(
      base({
        certifications: [
          { status: "active", expiration_date: "2029-01-01" },
          { status: "active", expiration_date: "2026-09-01" },
        ],
        ceuCompliance: compliantCeu,
      }),
    );
    expect(steps.find((s) => s.id === "renew-certification")!.dueDate).toBe("2026-09-01");
  });

  it("treats a far-off renewal as not-yet-actionable (todo, low priority)", () => {
    const steps = buildMemberPlan(
      base({
        certifications: [{ status: "active", expiration_date: "2030-01-01" }],
        ceuCompliance: compliantCeu,
      }),
    );
    const renew = steps.find((s) => s.id === "renew-certification")!;
    expect(renew.status).toBe("todo");
    expect(renew.priority).toBe("low");
  });
});

describe("isPlanComplete", () => {
  it("is true only when every step is done", () => {
    const allDone = buildMemberPlan(
      base({
        profileCompleteness: 100,
        accountStatus: "approved",
        certifications: [{ status: "active", expiration_date: "2030-01-01" }],
        ceuCompliance: compliantCeu,
        missingDocuments: 0,
      }),
    );
    // The far-off renewal stays "todo", so the plan is not fully complete —
    // that's intentional (renewal is an ongoing obligation).
    expect(isPlanComplete(allDone)).toBe(false);

    const noCertDone = buildMemberPlan(
      base({ profileCompleteness: 100, accountStatus: "approved", missingDocuments: 0 }),
    );
    expect(isPlanComplete(noCertDone)).toBe(true);

    expect(isPlanComplete([])).toBe(false);
  });
});
