import { optionalUserId } from "@/lib/auth/current-user";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { CtaButton } from "@/components/cta-button";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ActivityTimeline, type ActivityEvent } from "@/components/dashboard/activity-timeline";
import { ActivityTimeline as JourneyTimeline } from "@/components/activity-timeline";
import { buildActivityFeed } from "@/lib/activity";
import { NextSteps } from "@/components/dashboard/next-steps";
import { MemberTasksCard, type MemberTask } from "@/components/dashboard/member-tasks-card";
import { MemberAgentPanel } from "@/components/agent/member-agent-panel";
import { buildMemberPlan, type AccountStatus } from "@/lib/member-plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCompliance, requirementsFromSchedule, CeuLike } from "@/lib/ceu-compliance";
import { type CertSchedule, findScheduleFor, computeDueFromExpiration } from "@/lib/schedules";
import { isAdminRole } from "@/lib/auth/roles";

export const metadata = { title: "My Account" };
export const dynamic = "force-dynamic";

interface Certification {
  id: string;
  cert_type: string | null;
  cert_number: string | null;
  status: string | null;
  expiration_date: string | null;
  sync_enabled: boolean | null;
}
interface Payment {
  id: string;
  product_name: string | null;
  amount_cents: number | null;
  status: string | null;
  created_at: string | null;
}
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}
interface CeuRecord extends CeuLike {
  id: string;
  course_name?: string | null;
  submitted_at?: string | null;
}
interface Application {
  id: string;
  app_type: string | null;
  cert_type: string | null;
  status: string | null;
  submitted_at: string | null;
}

function completeness(p: Profile | null): number {
  if (!p) return 0;
  const fields = [p.first_name, p.last_name, p.phone, p.address_line1, p.city, p.state, p.zip_code];
  const filled = fields.filter((f) => f && String(f).trim()).length;
  return Math.round((filled / fields.length) * 100);
}

const RENEWAL_SLUG = "certification-renewal-2-year-credential-renewal-fee";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function daysLeft(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function money(cents: number | null) {
  return "$" + ((cents ?? 0) / 100).toFixed(2);
}
function titleCase(s: string) {
  return s.replace(/\b\w/g, (l) => l.toUpperCase());
}

export default async function AccountPage() {
  const supabase = createSupabaseServerClient();
  const userId = optionalUserId();

  let profile: Profile | null = null;
  let certifications: Certification[] = [];
  let payments: Payment[] = [];
  let ceuRecords: CeuRecord[] = [];
  let applications: Application[] = [];
  let schedules: CertSchedule[] = [];
  let memberTasks: MemberTask[] = [];
  let unreadMessages = 0;
  let openDocRequests = 0;
  let backendReady = true;

  if (userId) {
    try {
      const { data: p, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      profile = p as Profile | null;
      const [
        { data: certs },
        { data: pays },
        { data: ceus },
        { data: apps },
        { count: msgCount },
        { count: docCount },
      ] = await Promise.all([
        supabase.from("certifications").select("*").eq("member_id", userId),
        supabase.from("payments").select("*").eq("member_id", userId).order("created_at", { ascending: false }),
        supabase
          .from("ceu_records")
          .select("id, hours, category, status, course_name, submitted_at")
          .eq("member_id", userId),
        supabase
          .from("applications")
          .select("id, app_type, cert_type, status, submitted_at")
          .eq("member_id", userId)
          .order("submitted_at", { ascending: false }),
        supabase.from("messages").select("*", { count: "exact", head: true }).eq("member_id", userId).eq("is_read", false),
        supabase.from("document_requests").select("*", { count: "exact", head: true }).eq("member_id", userId).eq("status", "open"),
      ]);
      certifications = (certs as Certification[]) ?? [];
      payments = (pays as Payment[]) ?? [];
      ceuRecords = (ceus as CeuRecord[]) ?? [];
      applications = (apps as Application[]) ?? [];
      // Reference rules — fetched separately and best-effort so a missing
      // cert_schedules table never breaks the dashboard (falls back to 90d / 40 CEU).
      try {
        const { data: scheds } = await supabase
          .from("cert_schedules")
          .select(
            "credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes",
          );
        schedules = (scheds as CertSchedule[]) ?? [];
      } catch {
        schedules = [];
      }
      // Admin-assigned tasks surfaced to the member. RLS already restricts this
      // to the member's own rows where visible_to_member = true, so a plain
      // select returns exactly the tasks meant for them. Best-effort: any error
      // leaves an empty list rather than breaking the dashboard. Read-only.
      try {
        const { data: tasks } = await supabase
          .from("member_tasks")
          .select("id, title, detail, status, priority, due_date")
          .eq("member_id", userId)
          .order("due_date", { ascending: true, nullsFirst: false });
        memberTasks = (tasks as MemberTask[]) ?? [];
      } catch {
        memberTasks = [];
      }
      unreadMessages = msgCount ?? 0;
      openDocRequests = docCount ?? 0;
    } catch {
      backendReady = false;
    }
  }

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member";
  const syncOn = certifications.some((c) => c.sync_enabled);
  const profilePct = completeness(profile);
  const isAdmin = isAdminRole((profile as { portal_role?: string | null } | null)?.portal_role);

  // Action items
  // CEU compliance is shown against the soonest-expiring active credential's
  // schedule when known; otherwise the 40/3/3 default applies.
  const activeCerts = certifications.filter((c) => c.status === "active");
  const primaryCert = activeCerts
    .slice()
    .sort((a, b) => {
      const aD = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
      const bD = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
      return aD - bD;
    })[0];
  const primarySchedule = findScheduleFor(schedules, primaryCert?.cert_type);
  const ceuCompliance = computeCompliance(ceuRecords, requirementsFromSchedule(primarySchedule));
  // "Expiring within 90 days" uses the schedule engine (grace-aware) per cert
  // when a matching schedule exists; otherwise falls back to raw expiration.
  const expiringCerts = activeCerts.filter((c) => {
    if (!c.expiration_date) return false;
    const schedule = findScheduleFor(schedules, c.cert_type);
    if (schedule) {
      const due = computeDueFromExpiration(schedule, c.expiration_date);
      // Surface anything within 90 days OR currently inside its grace window.
      return (due.daysUntilDue <= 90 && due.daysUntilDue > 0) || due.inGracePeriod;
    }
    const t = new Date(c.expiration_date).getTime();
    return t <= Date.now() + 90 * 86400000 && t > Date.now();
  });
  // Only nag about CEUs once the member actually holds an active credential to
  // renew — otherwise a brand-new member with no certs sees "40 hours needed."
  const hasActiveCert = certifications.some((c) => c.status === "active");
  const showCeuActionItem = hasActiveCert && !ceuCompliance.compliant;
  const hasActionItems =
    unreadMessages > 0 || openDocRequests > 0 || showCeuActionItem || expiringCerts.length > 0;

  // ── Home dashboard (KPI cards + quick actions + activity) ──────────────────
  const firstName = profile?.first_name?.trim() || displayName.split(" ")[0] || "Member";

  // KPI 3: Next renewal — soonest-expiring active credential, schedule-aware.
  const primaryDue =
    primaryCert && primaryCert.expiration_date
      ? (() => {
          const sched = findScheduleFor(schedules, primaryCert.cert_type);
          const nextDue = sched
            ? computeDueFromExpiration(sched, primaryCert.expiration_date).nextDueDate
            : primaryCert.expiration_date;
          return { date: nextDue, days: daysLeft(nextDue) };
        })()
      : null;

  // KPI 4: IC&RC / cert status — derive from active certs or the latest app.
  const latestApp = applications[0];
  const statusKpi: { value: string; sub: string } = activeCerts.length > 0
    ? { value: "Active", sub: "Certification in good standing" }
    : latestApp
      ? {
          value: titleCase(latestApp.status ?? "submitted"),
          sub: titleCase((latestApp.app_type ?? "Application").replace(/_/g, " ")),
        }
      : { value: "—", sub: "No active certification" };

  // Banner message mirrors the static portal's contextual copy.
  const bannerMessage =
    activeCerts.length === 0
      ? "Complete your profile and upload your supporting documents to get started with your certification."
      : ceuCompliance.remaining > 0
        ? `Your certifications are active. ${ceuCompliance.remaining} CEU hour${ceuCompliance.remaining !== 1 ? "s" : ""} remaining to stay compliant.`
        : primaryDue?.days && primaryDue.days > 0
          ? `Your certifications are active and in good standing — ${primaryDue.days} days until your next renewal.`
          : "Your certifications are active and in good standing.";

  // ── "Your Next Steps" guided plan ──────────────────────────────────────────
  // Map already-fetched data into the pure plan builder. For active certs we
  // pass the schedule-aware next-due date (same date the KPI/credential cards
  // show) so the renewal step lines up with the rest of the dashboard.
  const planCerts = certifications.map((c) => {
    const sched = findScheduleFor(schedules, c.cert_type);
    const nextDue =
      sched && c.expiration_date
        ? computeDueFromExpiration(sched, c.expiration_date).nextDueDate
        : c.expiration_date ?? null;
    return { cert_type: c.cert_type, status: c.status, expiration_date: nextDue };
  });
  const planAccountStatus: AccountStatus =
    activeCerts.length > 0
      ? "active"
      : ((latestApp?.status as AccountStatus | undefined) ?? "none");
  const planSteps = buildMemberPlan({
    profileCompleteness: profilePct,
    accountStatus: planAccountStatus,
    certifications: planCerts,
    ceuCompliance,
    missingDocuments: openDocRequests,
  });

  const quickActions = [
    { href: "/account/ceus", label: "Log CEU Hours", icon: "📚" },
    { href: "/account/renew", label: "Renew Certification", icon: "🔄" },
    { href: "/account/certifications", label: "View Certificate", icon: "🏅" },
    { href: "/account/documents", label: "Upload Documents", icon: "📄" },
    { href: "/account/requests", label: "IC&RC Transfer", icon: "🌐" },
    {
      href: "/account/messages",
      label: unreadMessages > 0 ? `Messages (${unreadMessages})` : "Messages",
      icon: "✉️",
    },
  ];

  // Recent activity — derived from real CEU / application / payment rows.
  const activityEvents: ActivityEvent[] = [
    ...ceuRecords
      .filter((r) => r.submitted_at)
      .map<ActivityEvent>((r) => ({
        date: r.submitted_at ?? null,
        title: `CEU ${r.status === "approved" ? "Approved" : "Submitted"}: ${r.course_name ?? "Course"}${r.hours ? ` (${r.hours} hrs)` : ""}`,
        status: r.status === "approved" ? "done" : "current",
      })),
    ...applications.map<ActivityEvent>((a) => ({
      date: a.submitted_at,
      title: `${a.cert_type ?? titleCase((a.app_type ?? "Certification").replace(/_/g, " "))} Application — ${titleCase((a.status ?? "submitted").replace(/_/g, " "))}`,
      status: a.status === "approved" ? "done" : "current",
    })),
    ...payments.map<ActivityEvent>((p) => ({
      date: p.created_at,
      title: `${p.status === "succeeded" || p.status === "paid" ? "Payment Received" : "Payment"}: ${money(p.amount_cents)}${p.product_name ? ` · ${p.product_name}` : ""}`,
      status: p.status === "succeeded" || p.status === "paid" ? "done" : "default",
    })),
  ]
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .slice(0, 6);

  // Compact "Recent activity" feed for the unified journey timeline — built from
  // the records already fetched above, newest-first, capped at 5. Links to the
  // full /account/activity page for everything else.
  const recentJourney = buildActivityFeed(
    {
      applications: applications as unknown as Record<string, unknown>[],
      certifications: certifications as unknown as Record<string, unknown>[],
      payments: payments as unknown as Record<string, unknown>[],
      ceuRecords: ceuRecords as unknown as Record<string, unknown>[],
    },
    { limit: 5 },
  );

  return (
    <>
      <PageHero eyebrow="Member Portal" title={`Welcome, ${displayName}`}>
        <div className="flex gap-4">
          <CtaButton href="/account/certifications" size="sm">My Certifications</CtaButton>
          <SignOutButton className="self-center text-sm font-semibold text-brand hover:text-brand-600">Log out</SignOutButton>
        </div>
      </PageHero>

      {!backendReady && (
        <Section compact>
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-6 text-muted">
            We couldn't load your records just now. Please refresh, or open the full portal.
          </div>
        </Section>
      )}

      {isAdmin && (
        <Section compact>
          <Link href="/admin" className="flex items-center justify-between rounded-xl border border-brand bg-brand/5 p-5">
            <div>
              <h3 className="text-base">ABCAC Admin Console</h3>
              <p className="mt-1 text-sm text-muted">Review approvals, documents, CEUs, and applications.</p>
            </div>
            <span className="font-semibold text-brand">Open →</span>
          </Link>
        </Section>
      )}

      {/* Home dashboard: welcome banner + KPI cards */}
      <Section compact>
        <WelcomeBanner firstName={firstName} message={bannerMessage} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Active Certifications"
            value={String(activeCerts.length)}
            sub={
              activeCerts.length > 0
                ? activeCerts.map((c) => c.cert_type).filter(Boolean).join(", ") || "Active"
                : "No active certifications"
            }
          />
          <KpiCard
            label="CEUs Completed"
            value={`${ceuCompliance.totalApproved} / ${ceuCompliance.requiredTotal}`}
            sub={`${ceuCompliance.remaining} hour${ceuCompliance.remaining !== 1 ? "s" : ""} remaining`}
            progress={ceuCompliance.percent}
          />
          <KpiCard
            label="Next Renewal"
            value={
              primaryDue
                ? new Date(primaryDue.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "—"
            }
            sub={
              primaryDue
                ? primaryDue.days !== null && primaryDue.days > 0
                  ? `${primaryDue.days} days remaining`
                  : "Past due"
                : activeCerts.length > 0
                  ? "No expiration set"
                  : "Apply for certification first"
            }
          />
          <KpiCard label="IC&RC Status" value={statusKpi.value} sub={statusKpi.sub} />
        </div>
      </Section>

      {/* Your Next Steps — guided plan toward certification / renewal */}
      <Section title="Your Next Steps" compact>
        <NextSteps steps={planSteps} />
      </Section>

      {/* Certification Insights — CEU analytics + recommended actions */}
      <Section title="Your Certification Insights" compact>
        <MemberAgentPanel />
      </Section>

      {/* Tasks assigned to you by ABCAC (read-only) */}
      <Section title="Tasks for You" compact>
        <MemberTasksCard tasks={memberTasks} />
      </Section>

      {/* Action items */}
      {hasActionItems && (
        <Section title="Action Items" compact>
          <div className="flex flex-col gap-3">
            {unreadMessages > 0 && (
              <Link
                href="/account/messages"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    {unreadMessages} unread message{unreadMessages !== 1 ? "s" : ""}
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    You have unread messages from ABCAC.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">View →</span>
              </Link>
            )}
            {openDocRequests > 0 && (
              <Link
                href="/account/documents"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    ABCAC requested {openDocRequests} document{openDocRequests !== 1 ? "s" : ""}
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    Please upload the requested document{openDocRequests !== 1 ? "s" : ""} to proceed.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Upload →</span>
              </Link>
            )}
            {showCeuActionItem && (
              <Link
                href="/account/ceus"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    {ceuCompliance.remaining} CEU hour{ceuCompliance.remaining !== 1 ? "s" : ""} still needed for renewal
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    You need {ceuCompliance.remaining} more approved CEU hour{ceuCompliance.remaining !== 1 ? "s" : ""} to meet the {ceuCompliance.requiredTotal}-hour requirement.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Add CEUs →</span>
              </Link>
            )}
            {expiringCerts.length > 0 && (
              <Link
                href="/account/renewals"
                className="flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-50/60 p-5 transition-colors hover:border-amber-500 dark:bg-amber-900/10"
              >
                <div>
                  <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">
                    {expiringCerts.length} credential{expiringCerts.length !== 1 ? "s" : ""} expiring within 90 days
                  </h3>
                  <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
                    Renew soon to avoid a lapse in certification status.
                  </p>
                </div>
                <span className="font-semibold text-amber-700 dark:text-amber-400">Renew →</span>
              </Link>
            )}
          </div>
        </Section>
      )}

      {/* Profile completeness */}
      {profilePct < 100 && (
        <Section compact>
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base">Complete your profile</h3>
                <p className="mt-1 text-sm text-muted">A complete profile helps ABCAC process your applications faster.</p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold text-brand">{profilePct}%</div>
                <Link href="/account/profile" className="text-sm font-semibold text-brand hover:text-brand-600">Finish →</Link>
              </div>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={profilePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completeness"
            >
              <div className="h-full bg-brand" style={{ width: `${profilePct}%` }} />
            </div>
          </div>
        </Section>
      )}

      {/* Quick actions */}
      <Section title="Quick Actions" compact>
        <QuickActions actions={quickActions} />
      </Section>

      {/* Recent activity */}
      <Section title="Recent Activity" compact>
        <ActivityTimeline events={activityEvents} />
      </Section>

      {/* Your activity — compact unified journey timeline */}
      <Section compact>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-ink">Your activity</h3>
              <p className="mt-0.5 text-sm text-muted">
                Applications, payments, credentials, and more — your full ABCAC history.
              </p>
            </div>
            <Link href="/account/activity" className="shrink-0 text-sm font-semibold text-brand hover:text-brand-600">
              View all →
            </Link>
          </div>
          <JourneyTimeline events={recentJourney} linkable emptyText="No activity yet." />
        </div>
      </Section>

      {/* Credentials */}
      <Section title="Your Credentials" compact>
        {certifications.length === 0 ? (
          <p className="text-muted">No credentials on file yet. Start with the certification path that fits you.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {certifications.map((c) => {
              // Next renewal date comes from the cert_schedules engine when this
              // credential has a matching schedule + expiration; else raw expiry.
              const schedule = findScheduleFor(schedules, c.cert_type);
              const due =
                schedule && c.expiration_date
                  ? computeDueFromExpiration(schedule, c.expiration_date)
                  : null;
              const nextDue = due?.nextDueDate ?? c.expiration_date;
              const d = due ? due.daysUntilDue : daysLeft(c.expiration_date);
              const lapsed = due ? due.lapsed : d !== null && d < 0;
              return (
                <div key={c.id} className="rounded-xl border border-line bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg">{c.cert_type ?? "Credential"}</h3>
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold capitalize text-muted">
                      {c.status ?? "unknown"}
                    </span>
                  </div>
                  {c.cert_number && <p className="mt-1 text-sm text-muted">No. {c.cert_number}</p>}
                  <p className="mt-2 text-sm text-muted">
                    Next renewal {fmtDate(nextDue)}
                    {due?.inGracePeriod
                      ? " · in grace period"
                      : lapsed
                        ? " · lapsed"
                        : d !== null && d > 0
                          ? ` · ${d} days left`
                          : ""}
                  </p>
                  <CtaButton href={`/store/${RENEWAL_SLUG}`} variant="outline" size="sm" className="mt-4">Renew</CtaButton>
                </div>
              );
            })}
          </div>
        )}
        {certifications.length === 0 && (
          <CtaButton href="/choose-your-cert-path" className="mt-6">Choose Your Cert Path</CtaButton>
        )}
      </Section>

      {/* Certification Sync */}
      <Section surface title="Certification Sync" compact>
        <p className="text-muted">
          {syncOn ? "Certification Sync is active on your account." : "Align all your renewal dates into one cycle for $15/month."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {syncOn ? (
            <CtaButton href="/api/stripe/portal" variant="outline">Manage Subscription</CtaButton>
          ) : (
            <CtaButton href="/store/certification-sync" variant="accent">Start Certification Sync</CtaButton>
          )}
        </div>
      </Section>

      {/* Payment history */}
      <Section title="Payment History" compact>
        {payments.length === 0 ? (
          <p className="text-muted">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 text-muted">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3">{p.product_name ?? "—"}</td>
                    <td className="px-4 py-3">{money(p.amount_cents)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{p.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">
          Manage your <Link href="/account/applications" className="font-semibold text-brand">applications</Link>,{" "}
          <Link href="/account/ceus" className="font-semibold text-brand">CEUs</Link>, and{" "}
          <Link href="/account/documents" className="font-semibold text-brand">documents</Link> from the tabs above.
        </p>
      </Section>
    </>
  );
}
