import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantTool, ToolExecutor } from "./run";
import {
  computeCompliance,
  requirementsFromSchedule,
  type CeuLike,
  type ComplianceResult,
} from "@/lib/ceu-compliance";
import {
  findScheduleFor,
  computeDueFromExpiration,
  addDays,
  daysBetween,
  type CertSchedule,
} from "@/lib/schedules";

/**
 * ADMIN planning / drafting tools (WP — gap planning).
 *
 * These extend the admin assistant so it can HELP PLAN rather than only answer
 * or act. Every tool here is strictly READ-ONLY or DRAFT-ONLY:
 *
 *   • summarize_member_status — reads the member's certs/CEUs/application/docs
 *     via the passed admin client and returns a structured status the model can
 *     narrate. No writes.
 *   • create_plan — derives an ORDERED list of steps with suggested due dates
 *     from the member's REAL data (cert expiration, CEU shortfall, missing
 *     docs). Returns a plan object only; it NEVER writes a row.
 *   • draft_message — composes a member-addressed message body from a brief and
 *     returns the draft text ONLY. It NEVER inserts into `messages`; a human
 *     admin sends it manually (via the existing send_message_to_member tool,
 *     after they have reviewed and approved the wording).
 *
 * The data-shaping logic lives in PURE functions (they take plain data in) so
 * they are unit-testable without a database. The executors are thin wrappers
 * that fetch real rows through the RLS-aware/service client and delegate to the
 * pure helpers. Mirrors the read pattern in admin-tools.ts get_member_overview.
 */

export interface PlanningToolContext {
  /** RLS-scoped cookie client — reads (the route already gated admin access). */
  sb: SupabaseClient;
  /** Service-role client — mirrors how admin reads/writes use `admin`. */
  admin: SupabaseClient;
}

// ── Plain data shapes the pure helpers operate on ──────────────────────────

export interface CertRow {
  cert_type: string | null;
  cert_number?: string | null;
  status: string | null;
  expiration_date: string | null;
  ic_rc_level?: string | null;
}

export interface DocRow {
  document_type: string | null;
  status: string | null;
}

export interface ApplicationRow {
  app_type: string | null;
  cert_type: string | null;
  status: string | null;
  submitted_at?: string | null;
}

export type PlanGoal = "initial certification" | "renewal";

export interface PlanStep {
  /** 1-based execution order. */
  order: number;
  /** Short, human-readable step title. */
  title: string;
  /** What the member must do / what is outstanding. */
  detail: string;
  /** Suggested due date (yyyy-mm-dd) the admin can adjust. Null when N/A. */
  due_date: string | null;
  /** Coarse category for grouping in the UI. */
  category: "application" | "documents" | "ceu" | "renewal" | "exam";
}

export interface MemberStatusSummary {
  member_id: string;
  name: string;
  account_status: string | null;
  cert_status: string | null;
  active_credentials: Array<{
    credential: string | null;
    cert_number: string | null;
    expiration_date: string | null;
  }>;
  pending_credentials: number;
  open_applications: Array<{ type: string | null; cert: string | null; status: string | null }>;
  documents: { total: number; pending: number; approved: number; rejected: number };
  ceu: Pick<ComplianceResult, "totalApproved" | "remaining" | "ethicsRemaining" | "culturalRemaining" | "compliant">;
}

export interface MemberPlan {
  member_id: string;
  goal: PlanGoal;
  /** Date the plan was computed against (yyyy-mm-dd). */
  as_of: string;
  steps: PlanStep[];
  /** A short flat note when no steps are needed (e.g. already compliant). */
  note?: string;
  /** IMPORTANT: this is a DRAFT plan; nothing was written to the database. */
  draft_only: true;
}

// Documents a complete initial-certification packet typically needs. Used only
// to flag what is MISSING — we never invent data the member already supplied.
const REQUIRED_INITIAL_DOCS = [
  "application",
  "transcript",
  "supervision",
  "background_check",
] as const;

const DEFAULT_STEP_SPACING_DAYS = 30;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pure: classify a member's document set into counts by status. */
export function summarizeDocuments(docs: DocRow[]): MemberStatusSummary["documents"] {
  const total = docs.length;
  const by = (s: string) => docs.filter((d) => (d.status ?? "").toLowerCase() === s).length;
  return { total, pending: by("pending"), approved: by("approved"), rejected: by("rejected") };
}

/**
 * Pure: which of the expected initial-certification documents are not yet on
 * file in an approved/pending state. Case-insensitive substring match against
 * the member's document_type values. Returns the missing requirement keys.
 */
export function missingInitialDocs(docs: DocRow[]): string[] {
  const present = docs
    .filter((d) => (d.status ?? "").toLowerCase() !== "rejected")
    .map((d) => (d.document_type ?? "").toLowerCase());
  return REQUIRED_INITIAL_DOCS.filter(
    (req) => !present.some((p) => p.includes(req.replace(/_/g, " ")) || p.includes(req)),
  );
}

/**
 * Pure: build an ORDERED plan toward a goal from already-fetched member data.
 *
 * No DB access — this is the unit-testable core of `create_plan`. The caller
 * fetches certs/CEUs/docs/applications/schedule and passes plain data in.
 *
 * Ordering rules:
 *  - "initial certification": application → missing documents → exam.
 *  - "renewal": CEU shortfall (total, then ethics, then cultural) → renewal
 *    paperwork due by the credential's expiration date.
 * Each step gets a suggested due date derived from REAL data where available
 * (credential expiration), otherwise spaced forward from `asOf`.
 */
export function buildPlan(args: {
  memberId: string;
  goal: PlanGoal;
  certs: CertRow[];
  ceus: CeuLike[];
  docs: DocRow[];
  applications: ApplicationRow[];
  schedule?: CertSchedule | null;
  asOf?: string | Date;
}): MemberPlan {
  const { memberId, goal, certs, ceus, docs, applications, schedule } = args;
  const asOf = args.asOf ? new Date(typeof args.asOf === "string" ? `${args.asOf.slice(0, 10)}T00:00:00Z` : args.asOf) : new Date();
  const asOfIso = toIsoDate(asOf);
  const steps: PlanStep[] = [];

  // A monotonically spaced fallback due date for steps with no anchor date.
  let spacing = 0;
  const nextSpacedDue = (): string => {
    spacing += DEFAULT_STEP_SPACING_DAYS;
    return addDays(asOfIso, spacing);
  };

  if (goal === "initial certification") {
    const hasOpenApp = applications.some(
      (a) => (a.status ?? "").toLowerCase() !== "approved" && (a.status ?? "") !== "",
    );
    if (!hasOpenApp) {
      steps.push({
        order: 0,
        title: "Submit certification application",
        detail:
          "No active certification application is on file. Start the application for the desired credential.",
        due_date: nextSpacedDue(),
        category: "application",
      });
    }

    for (const missing of missingInitialDocs(docs)) {
      steps.push({
        order: 0,
        title: `Provide ${missing.replace(/_/g, " ")}`,
        detail: `Required supporting document "${missing.replace(/_/g, " ")}" is not yet on file (or was rejected).`,
        due_date: nextSpacedDue(),
        category: "documents",
      });
    }

    const pendingDocs = docs.filter((d) => (d.status ?? "").toLowerCase() === "pending").length;
    if (pendingDocs > 0) {
      steps.push({
        order: 0,
        title: "Await document review",
        detail: `${pendingDocs} submitted document(s) are pending ABCAC review.`,
        due_date: nextSpacedDue(),
        category: "documents",
      });
    }

    steps.push({
      order: 0,
      title: "Schedule and pass the IC&RC exam",
      detail:
        "Once the application and documents are accepted, schedule the IC&RC exam (in-person in Phoenix/Flagstaff or remote proctoring).",
      due_date: nextSpacedDue(),
      category: "exam",
    });
  } else {
    // renewal
    const records = ceus;
    const compliance = computeCompliance(records, requirementsFromSchedule(schedule ?? undefined));

    if (compliance.remaining > 0) {
      steps.push({
        order: 0,
        title: `Earn ${compliance.remaining} more CEU hour(s)`,
        detail: `${compliance.totalApproved} of ${compliance.requiredTotal} approved CEU hours on file. ${compliance.remaining} more needed for renewal.`,
        due_date: null,
        category: "ceu",
      });
    }
    if (compliance.ethicsRemaining > 0) {
      steps.push({
        order: 0,
        title: `Earn ${compliance.ethicsRemaining} more Ethics CEU hour(s)`,
        detail: `Ethics requirement is ${compliance.requiredEthics} hour(s); ${compliance.ethicsRemaining} still needed.`,
        due_date: null,
        category: "ceu",
      });
    }
    if (compliance.culturalRemaining > 0) {
      steps.push({
        order: 0,
        title: `Earn ${compliance.culturalRemaining} more Cultural Diversity CEU hour(s)`,
        detail: `Cultural Diversity requirement is ${compliance.requiredCultural} hour(s); ${compliance.culturalRemaining} still needed.`,
        due_date: null,
        category: "ceu",
      });
    }

    // Anchor renewal paperwork to the active credential's expiration date.
    const activeCert = certs.find((c) => (c.status ?? "").toLowerCase() === "active" && c.expiration_date);
    let renewalDue: string | null = null;
    if (activeCert?.expiration_date) {
      const due = computeDueFromExpiration(
        { grace_period_days: schedule?.grace_period_days ?? 0 },
        activeCert.expiration_date,
        asOfIso,
      );
      renewalDue = due.nextDueDate;
    }

    // Back-date CEU step due dates so CEUs are finished before paperwork is due.
    if (renewalDue) {
      const ceuDue = daysBetween(asOfIso, renewalDue) > 30 ? addDays(renewalDue, -30) : asOfIso;
      for (const s of steps) {
        if (s.category === "ceu") s.due_date = ceuDue;
      }
    } else {
      for (const s of steps) {
        if (s.category === "ceu" && s.due_date === null) s.due_date = nextSpacedDue();
      }
    }

    steps.push({
      order: 0,
      title: "Submit renewal before expiration",
      detail: activeCert?.cert_type
        ? `Renew the ${activeCert.cert_type} credential (expires ${activeCert.expiration_date ?? "unknown"}) and pay any renewal fee.`
        : "Submit the renewal application and pay any renewal fee.",
      due_date: renewalDue,
      category: "renewal",
    });
  }

  // Number the steps in their pushed order (already the intended sequence).
  steps.forEach((s, i) => (s.order = i + 1));

  const plan: MemberPlan = {
    member_id: memberId,
    goal,
    as_of: asOfIso,
    steps,
    draft_only: true,
  };
  if (steps.length === 1 && goal === "renewal" && steps[0].category === "renewal") {
    plan.note =
      "CEU requirements appear satisfied; only the renewal submission remains before the credential expires.";
  }
  return plan;
}

/**
 * Pure: compose a member-addressed message DRAFT from a short brief. Returns
 * the draft body text only — this NEVER sends or writes anything.
 */
export function composeDraftMessage(args: {
  memberName?: string | null;
  brief: string;
  steps?: PlanStep[];
}): string {
  const greeting = `Dear ${args.memberName?.trim() || "Member"},`;
  const lines: string[] = [greeting, ""];
  lines.push(args.brief.trim());
  if (args.steps && args.steps.length > 0) {
    lines.push("", "Your next steps:");
    for (const s of args.steps) {
      const when = s.due_date ? ` (suggested by ${s.due_date})` : "";
      lines.push(`${s.order}. ${s.title}${when} — ${s.detail}`);
    }
  }
  lines.push(
    "",
    "Please reach out to the ABCAC office at 480-980-1770 or abcac@abcac.org with any questions.",
    "",
    "Warm regards,",
    "The ABCAC Team",
  );
  return lines.join("\n");
}

// ── Tool definitions (admin surface) ───────────────────────────────────────

export function getPlanningTools(): AssistantTool[] {
  return [
    {
      name: "summarize_member_status",
      description:
        "Read-only. Gather a member's certifications, CEU compliance, open applications, and document review status by id, and return a structured status summary you can narrate. Does NOT change anything.",
      input_schema: {
        type: "object",
        properties: { member_id: { type: "string", description: "The member's profile id." } },
        required: ["member_id"],
      },
    },
    {
      name: "create_plan",
      description:
        "Planning only (NO writes). Build an ordered, dated action plan toward a goal for a member, derived from their real data: open application + missing documents for 'initial certification', or CEU shortfall + renewal-before-expiration for 'renewal'. Returns a draft plan object; present it to the admin as clear numbered steps with dates. Nothing is saved.",
      input_schema: {
        type: "object",
        properties: {
          member_id: { type: "string", description: "The member's profile id." },
          goal: {
            type: "string",
            enum: ["initial certification", "renewal"],
            description: "What the plan should achieve.",
          },
        },
        required: ["member_id", "goal"],
      },
    },
    {
      name: "draft_message",
      description:
        "Drafting only (NEVER sends). Compose a member-addressed message body from a short brief (optionally weaving in a plan's steps). Returns the draft text for the admin to review and edit. To actually deliver it, the admin uses send_message_to_member after approving the wording.",
      input_schema: {
        type: "object",
        properties: {
          member_id: { type: "string", description: "The member's profile id (used to address them by name)." },
          brief: { type: "string", description: "The core point the message should make, in plain language." },
          include_plan_goal: {
            type: "string",
            enum: ["initial certification", "renewal"],
            description: "Optional: if set, append the member's plan steps for this goal to the draft.",
          },
        },
        required: ["member_id", "brief"],
      },
    },
  ];
}

async function fetchSchedules(client: SupabaseClient): Promise<CertSchedule[]> {
  try {
    const { data } = await client
      .from("cert_schedules")
      .select(
        "credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes",
      );
    return (data as CertSchedule[]) ?? [];
  } catch {
    return [];
  }
}

export function getPlanningExecutors(ctx: PlanningToolContext): Record<string, ToolExecutor> {
  const { sb } = ctx;

  async function gather(memberId: string) {
    const [
      { data: profile },
      { data: certs },
      { data: ceus },
      { data: docs },
      { data: applications },
      schedules,
    ] = await Promise.all([
      sb.from("profiles").select("first_name,last_name,account_status,cert_status").eq("id", memberId).maybeSingle(),
      sb.from("certifications").select("cert_type,cert_number,status,expiration_date,ic_rc_level").eq("member_id", memberId),
      sb.from("ceu_records").select("hours,category,status").eq("member_id", memberId),
      sb.from("documents").select("document_type,status").eq("member_id", memberId),
      sb.from("applications").select("app_type,cert_type,status,submitted_at").eq("member_id", memberId),
      fetchSchedules(sb),
    ]);
    return {
      profile: profile ?? null,
      certs: (certs as CertRow[]) ?? [],
      ceus: (ceus as CeuLike[]) ?? [],
      docs: (docs as DocRow[]) ?? [],
      applications: (applications as ApplicationRow[]) ?? [],
      schedules: schedules ?? [],
    };
  }

  function nameOf(profile: { first_name?: string | null; last_name?: string | null } | null): string {
    return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member";
  }

  return {
    async summarize_member_status(input) {
      const memberId = String(input.member_id ?? "");
      if (!memberId) throw new Error("member_id is required.");
      const { profile, certs, ceus, docs, applications, schedules } = await gather(memberId);

      const activeCert = certs.find((c) => (c.status ?? "").toLowerCase() === "active");
      const schedule = findScheduleFor(schedules, activeCert?.cert_type);
      const compliance = computeCompliance(ceus, requirementsFromSchedule(schedule));

      const summary: MemberStatusSummary = {
        member_id: memberId,
        name: nameOf(profile),
        account_status: profile?.account_status ?? null,
        cert_status: profile?.cert_status ?? null,
        active_credentials: certs
          .filter((c) => (c.status ?? "").toLowerCase() === "active")
          .map((c) => ({
            credential: c.cert_type,
            cert_number: c.cert_number ?? null,
            expiration_date: c.expiration_date,
          })),
        pending_credentials: certs.filter((c) => (c.status ?? "").toLowerCase() === "pending").length,
        open_applications: applications
          .filter((a) => (a.status ?? "").toLowerCase() !== "approved")
          .map((a) => ({ type: a.app_type, cert: a.cert_type, status: a.status })),
        documents: summarizeDocuments(docs),
        ceu: {
          totalApproved: compliance.totalApproved,
          remaining: compliance.remaining,
          ethicsRemaining: compliance.ethicsRemaining,
          culturalRemaining: compliance.culturalRemaining,
          compliant: compliance.compliant,
        },
      };
      return JSON.stringify(summary);
    },

    async create_plan(input) {
      const memberId = String(input.member_id ?? "");
      const goal = String(input.goal ?? "") as PlanGoal;
      if (!memberId) throw new Error("member_id is required.");
      if (goal !== "initial certification" && goal !== "renewal") {
        throw new Error("goal must be 'initial certification' or 'renewal'.");
      }
      const { certs, ceus, docs, applications, schedules } = await gather(memberId);
      const activeCert = certs.find((c) => (c.status ?? "").toLowerCase() === "active");
      const schedule = findScheduleFor(schedules, activeCert?.cert_type) ?? null;

      const plan = buildPlan({ memberId, goal, certs, ceus, docs, applications, schedule });
      return JSON.stringify(plan);
    },

    async draft_message(input) {
      const memberId = String(input.member_id ?? "");
      const brief = String(input.brief ?? "").trim();
      if (!memberId) throw new Error("member_id is required.");
      if (!brief) throw new Error("brief is required.");

      const { profile, certs, ceus, docs, applications, schedules } = await gather(memberId);

      let steps: PlanStep[] | undefined;
      const goalRaw = input.include_plan_goal ? String(input.include_plan_goal) : "";
      if (goalRaw === "initial certification" || goalRaw === "renewal") {
        const activeCert = certs.find((c) => (c.status ?? "").toLowerCase() === "active");
        const schedule = findScheduleFor(schedules, activeCert?.cert_type) ?? null;
        steps = buildPlan({
          memberId,
          goal: goalRaw,
          certs,
          ceus,
          docs,
          applications,
          schedule,
        }).steps;
      }

      const draft = composeDraftMessage({ memberName: nameOf(profile), brief, steps });
      // DRAFT ONLY — return the text; the admin sends it manually after review.
      return JSON.stringify({ draft_only: true, draft });
    },
  };
}
