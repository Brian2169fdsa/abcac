import { requireUserId } from "@/lib/auth/current-user";
import { Check, X } from "lucide-react";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { CtaButton } from "@/components/cta-button";
import { ApplicationsStatusChip } from "@/components/account/applications-status-chip";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Application Status" };
export const dynamic = "force-dynamic";

interface Application {
  id: string; app_type: string | null; cert_type: string | null; status: string | null;
  submitted_at: string | null; reviewed_at: string | null; est_completion: string | null; admin_notes: string | null;
}
interface Payment { slug: string | null; product_name: string | null; created_at: string | null; }

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
function feePaid(appType: string | null, payments: Payment[]): boolean {
  const slugs = payments.map((p) => p.slug ?? "");
  if (appType === "cert_sync") return slugs.includes("certification-sync");
  if (appType === "renewal") return slugs.some((s) => s.includes("renewal"));
  if (appType === "initial") return slugs.some((s) => s.startsWith("initial-certification") || s.includes("certification-only"));
  return payments.length > 0;
}

function Timeline({ status }: { status: string | null }) {
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

  const [{ data: apps }, { data: pays }, { count: docCount }] = await Promise.all([
    supabase.from("applications").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
    supabase.from("payments").select("slug,product_name,created_at").eq("member_id", uid),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("member_id", uid),
  ]);
  const applications = (apps as Application[]) ?? [];
  const payments = (pays as Payment[]) ?? [];

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
                    <p className="text-sm text-muted">Submitted {fmt(a.submitted_at)}</p>
                  </div>
                  <ApplicationsStatusChip status={a.status} />
                </div>

                <Timeline status={a.status} />

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-line bg-bg p-3 text-sm">
                    <div className="text-muted">Fee</div>
                    <div className={`font-semibold ${feePaid(a.app_type, payments) ? "text-success" : "text-amber-600"}`}>
                      {feePaid(a.app_type, payments) ? "Paid" : "Not recorded"}
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

                {(a.status === null || a.status === "submitted") && !feePaid(a.app_type, payments) && (
                  <p className="mt-4 text-sm text-muted">
                    Tip: complete your fee and upload any{" "}
                    <a href="/account/documents" className="font-semibold text-brand">required documents</a> to speed up review.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
