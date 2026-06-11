import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompliance, requirementsFromSchedule } from "@/lib/ceu-compliance";
import { type CertSchedule, findScheduleFor, computeDueFromExpiration } from "@/lib/schedules";
import { buildMemberPlan, type AccountStatus } from "@/lib/member-plan";
import { ViewFileButton } from "@/components/view-file-button";
import { AccountApprovalActions } from "@/components/admin/account-approval-actions";
import { MemberManage } from "@/components/admin/member-manage";
import { IssueCertForm } from "@/components/admin/issue-cert-form";
import { ReviewActions } from "@/components/admin/review-actions";
import { RequestReviewActions } from "@/components/admin/request-review-actions";
import { AppStatusControl } from "@/components/admin/app-status-control";
import { RequestDocumentForm } from "@/components/admin/request-document";
import { SendMessageForm } from "@/components/admin/send-message-form";
import { CreateInvoiceForm } from "@/components/admin/create-invoice-form";
import { MemberDetailSection, FieldGrid, DataTable } from "@/components/admin/member-detail-section";
import { MemberDocsPanel } from "@/components/admin/member-docs-panel";
import { MemberProgressPanel } from "@/components/admin/member-progress-panel";
import { MemberDuePanel } from "@/components/admin/member-due-panel";
import { CockpitQuickActions } from "@/components/admin/cockpit-quick-actions";
import { SendReminderButton } from "@/components/admin/send-reminder-button";
import { MemberTasksPanel, type MemberTask } from "@/components/admin/member-tasks-panel";
import { MemberInvoicesPanel } from "@/components/admin/member-invoices-panel";
import { MemberMessagesThread } from "@/components/admin/member-messages-thread";
import { MemberPlanPanel } from "@/components/admin/member-plan-panel";
import { RoleManager } from "@/components/admin/role-manager";
import { MemberProfileEdit } from "@/components/admin/member-profile-edit";
import { MemberNotifyPrefs } from "@/components/admin/member-notify-prefs";
import { MemberEmploymentManage } from "@/components/admin/member-employment-manage";
import { MemberOtherCertManage } from "@/components/admin/member-othercert-manage";
import { MemberCertManage } from "@/components/admin/member-cert-manage";
import { MemberApplicationReview } from "@/components/admin/member-application-review";
import { MemberInvoiceManage } from "@/components/admin/member-invoice-manage";
import { MemberSupervisionManage } from "@/components/admin/member-supervision-manage";
import { MemberAuthorizationManage } from "@/components/admin/member-authorization-manage";
import { isSuperadminRole, type PortalRole } from "@/lib/auth/roles";
import { directoryListingLabel } from "@/lib/directory";

export const dynamic = "force-dynamic";

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function fmtDT(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function money(c: number | null | undefined) {
  return "$" + ((c ?? 0) / 100).toFixed(2);
}
function cap(s: string | null | undefined) {
  return (s ?? "—").replace(/_/g, " ");
}

/**
 * Runs an optional Supabase query and degrades gracefully: if the table or a
 * column does not exist (e.g. a not-yet-applied migration), or the client has
 * no credentials, return an empty list instead of throwing. This keeps the page
 * (and `npm run build`) from crashing.
 */
async function safeList<T = any>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await p;
    if (error) {
      // Surface the real failure server-side so an RLS/query error is visible in
      // logs instead of silently rendering as "No records" (E2E #5).
      console.error("[admin/members/[id]] safeList query failed:", error);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error("[admin/members/[id]] safeList threw:", err);
    return [];
  }
}

async function safeOne<T = any>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await p;
    if (error) {
      console.error("[admin/members/[id]] safeOne query failed:", error);
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error("[admin/members/[id]] safeOne threw:", err);
    return null;
  }
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const tone =
    s === "approved" || s === "active" || s === "paid" || s === "completed" || s === "verified" || s === "fulfilled"
      ? "bg-green-100 text-green-800"
      : s === "rejected" || s === "not_verified" || s === "expired"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {cap(status) || "—"}
    </span>
  );
}

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const sb = createSupabaseServerClient();
  const memberId = params.id;

  const profile = await safeOne<any>(
    sb.from("profiles").select("*").eq("id", memberId).maybeSingle(),
  );
  if (!profile) notFound();

  // Determine the signed-in admin's own role to gate role management. Only the
  // superadmin "god account" may change portal roles; the server action
  // re-checks this regardless, so this boolean is purely a UI gate.
  const {
    data: { user: viewer },
  } = await sb.auth.getUser();
  const viewerProfile = viewer
    ? await safeOne<any>(sb.from("profiles").select("portal_role").eq("id", viewer.id).maybeSingle())
    : null;
  const canManageRoles = isSuperadminRole(viewerProfile?.portal_role);
  const memberRole: PortalRole =
    profile.portal_role === "admin" || profile.portal_role === "superadmin"
      ? profile.portal_role
      : "member";

  // Fetch every member surface defensively. Tables/columns from not-yet-applied
  // migrations degrade to empty rather than crashing the render.
  const [
    employment,
    certs,
    otherCerts,
    ceuRecords,
    documents,
    docRequests,
    applications,
    payments,
    supervisionAsSupervisor,
    supervisionAsMember,
    supervisionAuthorizations,
    nameChanges,
    verifications,
    reciprocity,
    messages,
    invoices,
    schedules,
    tasks,
  ] = await Promise.all([
    safeList(sb.from("employment_records").select("*").eq("member_id", memberId).order("start_date", { ascending: false })),
    safeList(sb.from("certifications").select("*").eq("member_id", memberId).order("issued_date", { ascending: false })),
    safeList(sb.from("other_certifications").select("*").eq("member_id", memberId).order("issued_date", { ascending: false })),
    safeList(sb.from("ceu_records").select("*").eq("member_id", memberId).order("completion_date", { ascending: false })),
    safeList(sb.from("documents").select("*").eq("member_id", memberId).order("uploaded_at", { ascending: false })),
    safeList(sb.from("document_requests").select("*").eq("member_id", memberId).order("created_at", { ascending: false })),
    safeList(sb.from("applications").select("*").eq("member_id", memberId).order("submitted_at", { ascending: false })),
    safeList(sb.from("payments").select("*").eq("member_id", memberId).order("created_at", { ascending: false })),
    // Supervision records are keyed on supervisor_id (this member supervising others)…
    safeList(sb.from("supervision_records").select("*, supervisor:supervisor_id(first_name,last_name,email)").eq("supervisor_id", memberId).order("start_date", { ascending: false })),
    // …and, since migration 023, where the member is the linked supervisee.
    safeList(sb.from("supervision_records").select("*, supervisor:supervisor_id(first_name,last_name,email)").eq("supervisee_member_id", memberId).order("start_date", { ascending: false })),
    // Optional table from a possible future migration.
    safeList(sb.from("supervision_authorizations").select("*").eq("member_id", memberId)),
    safeList(sb.from("name_change_requests").select("*").eq("member_id", memberId).order("submitted_at", { ascending: false })),
    safeList(sb.from("verification_requests").select("*").eq("member_id", memberId).order("submitted_at", { ascending: false })),
    safeList(sb.from("reciprocity_requests").select("*").eq("member_id", memberId).order("submitted_at", { ascending: false })),
    safeList(sb.from("messages").select("*").eq("member_id", memberId).order("created_at", { ascending: false })),
    safeList(sb.from("invoices").select("*").eq("member_id", memberId).order("created_at", { ascending: false })),
    // Per-credential renewal rules (cert_schedules, migration 016). Read-only;
    // degrades to [] when the table/rows are absent → 40/3/3 default applies.
    safeList(
      sb
        .from("cert_schedules")
        .select(
          "credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes",
        ),
    ),
    // Per-member tasks (member_tasks) — the ClickUp replacement. Ordered so the
    // panel can re-sort; active-first by due date is finalized client-side.
    safeList(
      sb
        .from("member_tasks")
        .select("*")
        .eq("member_id", memberId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ),
  ]);

  // CEU denominators come from the member's actual credential. Mirror the member
  // dashboard / CEU page: use the soonest-expiring active credential's schedule
  // when known, defaulting to 40/3/3 when no cert_schedules row matches.
  const primaryCredential = (certs as any[])
    .filter((c) => c.status === "active")
    .slice()
    .sort((a, b) => {
      const aD = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
      const bD = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
      return aD - bD;
    })[0]?.cert_type ?? null;
  const primarySchedule = findScheduleFor(schedules as CertSchedule[], primaryCredential);
  const requirements = requirementsFromSchedule(primarySchedule);

  const compliance = computeCompliance(
    (ceuRecords as any[]).map((r) => ({ hours: r.hours ?? null, category: r.category ?? null, status: r.status ?? null })),
    requirements,
  );

  // ── Member's guided "Next Steps" plan ──────────────────────────────────────
  // Assemble the SAME input the member dashboard feeds buildMemberPlan() so the
  // admin sees exactly the plan the client is shown (read-only). Mirrors
  // src/app/(portal)/account/page.tsx.
  // Member's notification preferences (admin can view + override). null = no row.
  const notifyPrefs = await safeOne<any>(
    sb.from("notification_preferences").select("*").eq("member_id", memberId).maybeSingle(),
  );

  const profileFields = [
    profile.first_name,
    profile.last_name,
    profile.phone,
    profile.address_line1,
    profile.city,
    profile.state,
    profile.zip_code,
  ];
  const profileCompleteness = Math.round(
    (profileFields.filter((f) => f && String(f).trim()).length / profileFields.length) * 100,
  );
  const openDocRequests = (docRequests as any[]).filter((r) => r.status === "open").length;
  const activeCerts = (certs as any[]).filter((c) => c.status === "active");
  const latestApp = (applications as any[])[0];
  // For active certs, pass the schedule-aware next-due date (same date the
  // member's renewal step uses) so the plan lines up with their dashboard.
  const planCerts = (certs as any[]).map((c) => {
    const sched = findScheduleFor(schedules as CertSchedule[], c.cert_type);
    const nextDue =
      sched && c.expiration_date
        ? computeDueFromExpiration(sched, c.expiration_date).nextDueDate
        : c.expiration_date ?? null;
    return { cert_type: c.cert_type, status: c.status, expiration_date: nextDue };
  });
  const planAccountStatus: AccountStatus =
    activeCerts.length > 0 ? "active" : ((latestApp?.status as AccountStatus | undefined) ?? "none");
  const planSteps = buildMemberPlan({
    profileCompleteness,
    accountStatus: planAccountStatus,
    certifications: planCerts,
    ceuCompliance: compliance,
    missingDocuments: openDocRequests,
  });

  const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || "—";

  // A single-member option for the preselected scoped forms.
  const memberOption = [{ id: memberId, label: `${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member"} (${profile.email ?? ""})` }];

  return (
    <>
      <div className="mb-4">
        <Link href="/admin/members" className="text-sm font-semibold text-brand hover:text-brand-600">← Back to members</Link>
      </div>

      {/* 1. Header + account/role controls */}
      <div className="mb-8 rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{fullName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span>{profile.email ?? "—"}</span>
              <span>{profile.phone ?? "—"}</span>
              <span>Joined {fmt(profile.created_at)}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-line px-2 py-0.5 capitalize text-muted">Cert: {cap(profile.cert_status)}</span>
              <StatusBadge status={profile.account_status} />
              <span className="rounded-full border border-line px-2 py-0.5 capitalize text-muted">Role: {cap(profile.portal_role)}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  profile.directory_opt_out
                    ? "bg-amber-100 text-amber-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                Public directory: {directoryListingLabel(profile.directory_opt_out)}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            {profile.account_status === "pending" && (
              <div>
                <div className="mb-1 text-right text-xs font-semibold uppercase tracking-wide text-muted">Account review</div>
                <AccountApprovalActions memberId={memberId} />
              </div>
            )}
            <div>
              <div className="mb-1 text-right text-xs font-semibold uppercase tracking-wide text-muted">Status / role</div>
              <MemberManage id={memberId} accountStatus={profile.account_status} role={profile.portal_role} />
            </div>
          </div>
        </div>
        {profile.account_review_notes && (
          <p className="mt-4 rounded-lg border border-line bg-bg p-3 text-sm text-muted">
            <span className="font-semibold text-ink">Review notes:</span> {profile.account_review_notes}
          </p>
        )}
      </div>

      {/* 1.5 Client-management cockpit — progress, what's due, and docs at a glance */}
      <MemberDetailSection
        title="Client Cockpit"
        description="Everything the owner used to track in ClickUp — this member's standing, what's due, and their documents — all from Supabase."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <MemberProgressPanel certs={certs as any[]} compliance={compliance} applications={applications as any[]} />
          <MemberDuePanel
            certs={certs as any[]}
            docRequests={docRequests as any[]}
            ceuRecords={ceuRecords as any[]}
            applications={applications as any[]}
          />
        </div>
        <div className="mt-6">
          <MemberDocsPanel documents={documents as any[]} />
        </div>

        {/* Actionable cockpit row — message + document request without leaving the page. */}
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold text-ink">Quick actions</div>
          <CockpitQuickActions memberId={memberId} />
          <div className="mt-3">
            <SendReminderButton memberId={memberId} />
          </div>
        </div>

        {/* Tasks — the ClickUp replacement: per-member task manager. */}
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold text-ink">Tasks</div>
          <MemberTasksPanel memberId={memberId} tasks={tasks as MemberTask[]} />
        </div>

        {/* Superadmin-only role management. */}
        {canManageRoles && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-semibold text-ink">Role management</div>
            <div className="max-w-md">
              <RoleManager memberId={memberId} currentRole={memberRole} />
            </div>
          </div>
        )}
      </MemberDetailSection>

      {/* 1.6 Client-view mirrors — what the member sees: their guided plan,
          invoices/payments, and message thread, all read-only. */}
      <MemberDetailSection
        title="Member's Next Steps"
        description="The guided plan this member is shown on their dashboard — exactly as the client sees it (read-only)."
      >
        <MemberPlanPanel steps={planSteps} />
      </MemberDetailSection>

      {/* 2. Personal Information + Employment */}
      <MemberDetailSection title="Personal Information">
        <FieldGrid
          items={[
            { label: "First name", value: profile.first_name ?? "—" },
            { label: "Middle name", value: profile.middle_name ?? "—" },
            { label: "Last name", value: profile.last_name ?? "—" },
            { label: "Email", value: profile.email ?? "—" },
            { label: "Phone", value: profile.phone ?? "—" },
            { label: "SSN (last 4)", value: profile.ssn_last4 ?? "—" },
            { label: "Date of birth", value: fmt(profile.date_of_birth) },
            { label: "Address", value: profile.address_line1 ?? "—" },
            { label: "City", value: profile.city ?? "—" },
            { label: "State", value: profile.state ?? "—" },
            { label: "ZIP", value: profile.zip_code ?? "—" },
            { label: "Stripe customer", value: profile.stripe_customer_id ?? "—" },
          ]}
        />
        <div className="mt-4">
          <MemberProfileEdit memberId={memberId} profile={profile} />
        </div>
      </MemberDetailSection>

      <MemberDetailSection title="Notification Preferences" description="What this member is opted in to. These gate the automated reminder emails.">
        <MemberNotifyPrefs memberId={memberId} prefs={notifyPrefs} />
      </MemberDetailSection>

      <MemberDetailSection title="Employment">
        <DataTable
          head={["Employer", "Position", "Start", "End", "Current"]}
          rows={(employment as any[]).map((e) => [
            e.employer_name ?? "—",
            e.position_title ?? "—",
            fmt(e.start_date),
            e.is_current ? "Present" : fmt(e.end_date),
            e.is_current ? "Yes" : "No",
          ])}
          empty="No employment records."
        />
        <div className="mt-4">
          <MemberEmploymentManage memberId={memberId} rows={employment as any[]} />
        </div>
      </MemberDetailSection>

      {/* 3. Certifications + Other Certifications + Issue cert */}
      <MemberDetailSection title="Certifications">
        <DataTable
          head={["Credential", "Number", "Level", "Issued", "Expires", "Sync", "Status"]}
          rows={(certs as any[]).map((c) => [
            c.cert_type ?? "—",
            c.cert_number ?? "—",
            c.ic_rc_level ?? "—",
            fmt(c.issued_date),
            fmt(c.expiration_date),
            c.sync_enabled ? "On" : "Off",
            <StatusBadge key="s" status={c.status} />,
          ])}
          empty="No certifications issued."
        />
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Issue a certification to this member</div>
          <IssueCertForm members={memberOption} defaultMemberId={memberId} />
        </div>
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Manage existing certifications</div>
          <MemberCertManage memberId={memberId} certs={certs as any[]} />
        </div>
      </MemberDetailSection>

      <MemberDetailSection title="Other Certifications">
        <DataTable
          head={["Credential", "Number", "Issuing board", "Issued", "Expires", "Document"]}
          rows={(otherCerts as any[]).map((c) => [
            c.credential_title ?? "—",
            c.credential_number ?? "—",
            c.issuing_board ?? "—",
            fmt(c.issued_date),
            fmt(c.expiration_date),
            c.doc_path ? <ViewFileButton key="v" bucket="member-documents" path={c.doc_path} /> : "—",
          ])}
          empty="No other certifications recorded."
        />
        <div className="mt-4">
          <MemberOtherCertManage memberId={memberId} rows={otherCerts as any[]} />
        </div>
      </MemberDetailSection>

      {/* 4. CEU records + compliance KPIs + per-record review */}
      <MemberDetailSection title="Continuing Education (CEUs)">
        <div className="mb-4 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold">Renewal compliance</span>
            {compliance.compliant ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Compliant</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Not yet compliant</span>
            )}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <div className="text-sm text-muted">Approved hours</div>
              <div className="mt-1 text-2xl font-bold text-ink">{compliance.totalApproved} / {compliance.requiredTotal}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Hours remaining</div>
              <div className="mt-1 text-2xl font-bold text-ink">{compliance.remaining}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Ethics</div>
              <div className="mt-1 text-2xl font-bold text-ink">{compliance.ethics} / {compliance.requiredEthics}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Cultural Diversity</div>
              <div className="mt-1 text-2xl font-bold text-ink">{compliance.cultural} / {compliance.requiredCultural}</div>
            </div>
          </div>
        </div>
        <DataTable
          head={["Course", "Provider", "Hrs", "Category", "Completed", "Certificate", "Status", "Actions"]}
          rows={(ceuRecords as any[]).map((r) => [
            r.course_name ?? "—",
            r.provider ?? "—",
            r.hours ?? "—",
            r.category ?? "—",
            fmt(r.completion_date),
            r.certificate_url ? <ViewFileButton key="v" bucket="ceu-certificates" path={r.certificate_url} /> : "—",
            <StatusBadge key="s" status={r.status} />,
            <ReviewActions key="a" table="ceu_records" id={r.id} status={r.status} />,
          ])}
          empty="No CEU records."
        />
      </MemberDetailSection>

      {/* 5. Documents + review + request-document */}
      <MemberDetailSection title="Documents">
        <DataTable
          head={["File", "Type", "Uploaded", "Status", "Review notes", "View", "Actions"]}
          rows={(documents as any[]).map((d) => [
            d.file_name ?? "—",
            d.document_type ?? "—",
            fmt(d.uploaded_at),
            <StatusBadge key="s" status={d.status} />,
            d.admin_notes ?? "—",
            d.file_path ? <ViewFileButton key="v" bucket="member-documents" path={d.file_path} label={d.file_name || "View"} /> : "—",
            <ReviewActions key="a" table="documents" id={d.id} status={d.status} />,
          ])}
          empty="No documents uploaded."
        />
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Open document requests</div>
          <DataTable
            head={["Requested document", "Note", "Requested", "Status"]}
            rows={(docRequests as any[]).map((r) => [
              r.document_type ?? "—",
              r.note ?? "—",
              fmt(r.created_at),
              <StatusBadge key="s" status={r.status} />,
            ])}
            empty="No document requests."
          />
        </div>
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Request a document from this member</div>
          <RequestDocumentForm members={memberOption} defaultMemberId={memberId} />
        </div>
      </MemberDetailSection>

      {/* 6. Applications + status control */}
      <MemberDetailSection title="Applications">
        <DataTable
          head={["Type", "Credential", "Submitted", "Reviewed", "Est. completion", "Status", "Actions"]}
          rows={(applications as any[]).map((a) => [
            cap(a.app_type),
            a.cert_type ?? "—",
            fmt(a.submitted_at),
            fmt(a.reviewed_at),
            fmt(a.est_completion),
            <StatusBadge key="s" status={a.status} />,
            <AppStatusControl key="a" id={a.id} status={a.status} />,
          ])}
          empty="No applications submitted."
        />
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Set reviewer notes &amp; estimated completion</div>
          <MemberApplicationReview memberId={memberId} applications={applications as any[]} />
        </div>
      </MemberDetailSection>

      {/* 7. Renewals — active certs + days-left, mirroring the member renewals page */}
      <MemberDetailSection title="Renewals" description="Active credentials and renewal urgency (computed from expiration dates).">
        <DataTable
          head={["Credential", "Number", "Expires", "Days left"]}
          rows={(certs as any[])
            .filter((c) => c.status === "active")
            .map((c) => {
              const days = c.expiration_date
                ? Math.ceil((new Date(c.expiration_date).getTime() - Date.now()) / 86_400_000)
                : null;
              const label =
                days === null ? "—" : days < 0 ? "Expired" : `${days}d${days <= 90 ? " (renew soon)" : ""}`;
              return [c.cert_type ?? "—", c.cert_number ?? "—", fmt(c.expiration_date), label];
            })}
          empty="No active certifications to renew."
        />
      </MemberDetailSection>

      {/* 8. Supervision — both directions (as supervisor / as supervisee, migration 023) */}
      <MemberDetailSection title="Supervision" description="Supervision this member provides (as supervisor) and receives (as supervisee).">
        <div className="mb-2 text-sm font-semibold">As supervisor</div>
        <DataTable
          head={["Supervisee", "Credential", "Linked member", "Start", "End", "Status"]}
          rows={(supervisionAsSupervisor as any[]).map((s) => [
            s.supervisee_name ?? "—",
            s.supervisee_credential ?? "—",
            s.supervisee_member_id ? "Yes" : "—",
            fmt(s.start_date),
            s.end_date ? fmt(s.end_date) : "Present",
            <StatusBadge key="s" status={s.status} />,
          ])}
          empty="No supervision provided."
        />
        <div className="mb-2 mt-6 text-sm font-semibold">As supervisee</div>
        <DataTable
          head={["Supervised by", "Their credential note", "Start", "End", "Status"]}
          rows={(supervisionAsMember as any[]).map((s) => {
            const sup = s.supervisor;
            const supName = sup
              ? ([sup.first_name, sup.last_name].filter(Boolean).join(" ") || sup.email || "—")
              : "—";
            return [
              supName,
              s.supervisee_credential ?? "—",
              fmt(s.start_date),
              s.end_date ? fmt(s.end_date) : "Present",
              <StatusBadge key="s" status={s.status} />,
            ];
          })}
          empty="Not recorded as a supervisee."
        />
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold">Manage supervision (as supervisor) &amp; link supervisees</div>
          <MemberSupervisionManage memberId={memberId} records={supervisionAsSupervisor as any[]} />
        </div>
        <div className="mt-6">
          <div className="mb-2 text-sm font-semibold">Authorizations</div>
          <MemberAuthorizationManage memberId={memberId} authorizations={supervisionAuthorizations as any[]} />
        </div>
      </MemberDetailSection>

      {/* 9. Requests: name change, verification, reciprocity */}
      <MemberDetailSection title="Name Change Requests">
        <DataTable
          head={["Current", "New", "Reason", "Submitted", "Doc", "Status", "Actions"]}
          rows={(nameChanges as any[]).map((r) => [
            r.current_name ?? "—",
            r.new_name ?? "—",
            r.reason ?? "—",
            fmt(r.submitted_at),
            r.doc_path ? <ViewFileButton key="v" bucket="name-change-docs" path={r.doc_path} /> : "—",
            <StatusBadge key="s" status={r.status} />,
            <RequestReviewActions key="a" table="name_change_requests" id={r.id} status={r.status} />,
          ])}
          empty="No name change requests."
        />
      </MemberDetailSection>

      <MemberDetailSection title="Verification Requests" description="One-click Verified / Not Verified decisions email the recipient.">
        <DataTable
          head={["Purpose", "Recipient", "Submitted", "Result", "Status", "Actions"]}
          rows={(verifications as any[]).map((r) => [
            r.purpose ?? "—",
            [r.recipient_name, r.recipient_email].filter(Boolean).join(" · ") || "—",
            fmt(r.submitted_at),
            r.verification_result ? cap(r.verification_result) : "—",
            <StatusBadge key="s" status={r.status} />,
            <RequestReviewActions key="a" table="verification_requests" id={r.id} status={r.status} />,
          ])}
          empty="No verification requests."
        />
      </MemberDetailSection>

      <MemberDetailSection title="Reciprocity Requests">
        <DataTable
          head={["Direction", "Credential", "Destination", "Reason", "Submitted", "Status", "Actions"]}
          rows={(reciprocity as any[]).map((r) => [
            cap(r.direction),
            r.credential ?? "—",
            r.destination ?? "—",
            r.reason ?? "—",
            fmt(r.submitted_at),
            <StatusBadge key="s" status={r.status} />,
            <RequestReviewActions key="a" table="reciprocity_requests" id={r.id} status={r.status} />,
          ])}
          empty="No reciprocity requests."
        />
      </MemberDetailSection>

      {/* 9.5 Client-view mirror — the member's message thread exactly as they
          read it on /account/messages (read-only). */}
      <MemberDetailSection
        title="Messages (member's view)"
        description="The conversation as the member sees it on their Messages page — chronological, read-only."
      >
        <MemberMessagesThread messages={messages as any[]} />
      </MemberDetailSection>

      {/* 9.6 Client-view mirror — the member's invoices & payments exactly as
          they see them on /account/invoices (read-only). */}
      <MemberDetailSection
        title="Invoices (member's view)"
        description="Invoices and payments as the member sees them on their Invoices page — read-only."
      >
        <MemberInvoicesPanel invoices={invoices as any[]} payments={payments as any[]} />
      </MemberDetailSection>

      {/* 10. Messages thread + send box scoped to this member */}
      <MemberDetailSection title="Messages">
        <DataTable
          head={["Date", "From", "Subject", "Message", "Read"]}
          rows={(messages as any[]).map((m) => [
            fmtDT(m.created_at),
            m.from_name ?? "—",
            m.subject ?? "—",
            m.body ?? "—",
            m.is_read ? "Read" : "Unread",
          ])}
          empty="No messages."
        />
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Send a message to this member</div>
          <SendMessageForm members={memberOption} defaultMemberId={memberId} />
        </div>
      </MemberDetailSection>

      {/* 11. Invoices + payments + create invoice scoped to this member */}
      <MemberDetailSection title="Invoices">
        <DataTable
          head={["Invoice #", "Description", "Amount", "Created", "Paid", "Status"]}
          rows={(invoices as any[]).map((inv) => [
            inv.invoice_number ?? "—",
            inv.description ?? "—",
            money(inv.amount_cents),
            fmt(inv.created_at),
            inv.paid_at ? fmt(inv.paid_at) : "—",
            <StatusBadge key="s" status={inv.status} />,
          ])}
          empty="No invoices."
        />
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Create an invoice for this member</div>
          <CreateInvoiceForm members={memberOption} defaultMemberId={memberId} />
        </div>
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">Manage existing invoices</div>
          <MemberInvoiceManage memberId={memberId} invoices={invoices as any[]} />
        </div>
      </MemberDetailSection>

      <MemberDetailSection title="Payments">
        <DataTable
          head={["Product", "Amount", "Mode", "Status", "Date"]}
          rows={(payments as any[]).map((p) => [
            p.product_name ?? p.slug ?? "—",
            money(p.amount_cents),
            cap(p.mode),
            <StatusBadge key="s" status={p.status} />,
            fmt(p.created_at),
          ])}
          empty="No payments recorded."
        />
      </MemberDetailSection>
    </>
  );
}
