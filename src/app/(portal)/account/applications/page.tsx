import { requireUserId } from "@/lib/auth/current-user";
import { Check, X } from "lucide-react";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CtaButton } from "@/components/cta-button";
import { ApplicationsStatusChip } from "@/components/account/applications-status-chip";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { paymentOptionsForApplication } from "@/lib/portal-routing";
import { getWorkflowForApplication } from "@/lib/form-library";

export const metadata = { title: "Application Status" };
export const dynamic = "force-dynamic";

interface Application {
  id: string; app_type: string | null; cert_type: string | null; status: string | null;
  submitted_at: string | null; reviewed_at: string | null; est_completion: string | null; admin_notes: string | null;
}
interface Payment { slug: string | null; product_name: string | null; created_at: string | null; }
interface PaymentSubmission { linked_record_id: string | null; status: string | null; }

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function title(s: string | null) {
  return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

const STEPS = ["Submitted", "Under Review", "Approved"] as const;

function stageIndex(status: string | null): number {
  switch (status) {
    case "submitted": return 0;
    case "under_review": return 1;
    case "approved": return 2;
    default: return 0;
  }
}

// Loosely associate a recorded payment with an application by type.
function feePaid(applicationId: string, appType: string | null, payments: Payment[], submissions: PaymentSubmission[]): boolean {
  if (submissions.some((submission) => submission.linked_record_id === applicationId && submission.status === "paid")) return true;
  const slugs = payments.map((p) => p.slug ?? "");
  if (appType === "cert_sync") return slugs.includes("certification-sync");
  if (appType === "renewal") return slugs.some((s) => s.includes("renewal"));
  if (appType === "initial") return slugs.some((s) => s.startsWith("initial-certification") || s.includes("certification-only"));
  return payments.length > 0;
}

/** Deep link back into the workspace (or dedicated page) that owns this application. */
function workspaceHref(a: Application): { href: string; label: string } | null {
  if (a.app_type === "cert_sync") return { href: "/account/certification-sync", label: "View sync request" };
  const workflow = getWorkflowForApplication(a.app_type, a.cert_type);
  if (!workflow) return null;
  const href = `/account/forms?workflow=${encodeURIComponent(workflow.key)}&application=${encodeURIComponent(a.id)}`;
  return a.status === "draft" ? { href, label: "Continue application" } : { href, label: "View packet" };
}

function Timeline({ status }: { status: string | null }) {
  if (status === "draft") {
    return (
      <div className="rounded-lg border border-dashed border-line bg-bg px-4 py-3 text-sm text-muted">
        Draft — not yet submitted to ABCAC. Continue the application to finish and submit it.
      </div>
    );
  }
  const rejected = status === "rejected";
  const idx = stageIndex(status);
  if (rejected) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
        <X className="h-4 w-4" aria-hidden /> Not approved — see reviewer notes below.
      </div>
    );
  }
  return (
    <ol className="flex items-center">
      {STEPS.map((label, i) => {
        const done = i < idx;
        const current = i === idx && status !== "approved";
        const complete = i <= idx && status === "approved";
        const active = done || complete;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${
                active ? "border-brand bg-brand text-white" : current ? "border-brand text-brand" : "border-line text-muted"
              }`}>
                {active ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={`mt-1 whitespace-nowrap text-xs font-semibold ${active || current ? "text-ink" : "text-muted"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={`mx-2 h-0.5 flex-1 ${i < idx ? "bg-brand" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

export default async function ApplicationsPage() {
  const supabase = createSupabaseServerClient();
  const __authUserId = await requireUserId();
  const uid = __authUserId;

  const [{ data: apps }, { data: pays }, { data: paymentSubmissions }, { count: docCount }] = await Promise.all([
    supabase.from("applications").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
    supabase.from("payments").select("slug,product_name,created_at").eq("member_id", uid),
    supabase.from("payment_submissions").select("linked_record_id,status").eq("member_id", uid).eq("linked_record_type", "applications"),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("member_id", uid),
  ]);
  const applications = (apps as Application[]) ?? [];
  const payments = (pays as Payment[]) ?? [];
  const submissions = (paymentSubmissions as PaymentSubmission[]) ?? [];

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Application Status" intro="Track where each of your certification and recertification applications stands." />
      <Section compact>
        {applications.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center">
            <p className="text-muted">You haven&apos;t submitted an application yet.</p>
            <div className="mt-4 flex justify-center gap-3">
              <CtaButton href="/account/apply">Apply for Certification</CtaButton>
              <CtaButton href="/account/certification" variant="outline">Submit Recertification</CtaButton>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {applications.map((a) => (
              <div key={a.id} className="rounded-xl border border-line bg-surface p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">{title(a.app_type)}{a.cert_type ? ` — ${a.cert_type}` : ""}</h3>
                    <p className="text-sm text-muted">{a.status === "draft" || !a.submitted_at ? "Saved draft" : `Submitted ${fmt(a.submitted_at)}`}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => { const link = workspaceHref(a); return link ? <CtaButton href={link.href} size="sm" variant={a.status === "draft" ? "primary" : "outline"}>{link.label}</CtaButton> : null; })()}
                    <ApplicationsStatusChip status={a.status} />
                  </div>
                </div>

                <Timeline status={a.status} />

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-line bg-bg p-3 text-sm">
                    <div className="text-muted">Fee</div>
                    <div
                      className={`font-semibold ${
                        feePaid(a.id, a.app_type, payments, submissions)
                          ? "text-success"
                          : "text-amber-600"
                      }`}
                    >
                      {feePaid(a.id, a.app_type, payments, submissions) ? "Paid" : "Not recorded"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-line bg-bg p-3 text-sm">
                    <div className="text-muted">Documents on file</div>
                    <div className="font-semibold text-ink">{docCount ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-line bg-bg p-3 text-sm">
                    <div className="text-muted">Est. completion</div>
                    <div className="font-semibold text-ink">{a.est_completion ? fmt(a.est_completion) : "—"}</div>
                  </div>
                </div>

                {a.admin_notes && (
                  <div className="mt-4 rounded-lg border border-line bg-bg p-4 text-sm">
                    <div className="font-semibold text-ink">Note from ABCAC</div>
                    <p className="mt-1 text-muted">{a.admin_notes}</p>
                  </div>
                )}

                {(a.status === null || a.status === "submitted") && !feePaid(a.id, a.app_type, payments, submissions) && (
                  <div className="mt-4 rounded-xl border border-brand/15 bg-brand/[0.04] p-4">
                    <p className="text-sm font-semibold text-ink">Complete the payment linked to this application</p>
                    <p className="mt-1 text-sm text-muted">Choose the correct option below. The payment will be recorded against this exact application.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {paymentOptionsForApplication(a.app_type ?? "", a.id).map((option) => (
                        <CtaButton key={option.href} href={option.href} size="sm">{option.label}</CtaButton>
                      ))}
                      <CtaButton href="/account/documents" variant="outline" size="sm">Review documents</CtaButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
