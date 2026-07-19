import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUserId } from "@/lib/auth/current-user";
import type { DigitalApplicationDetails } from "@/lib/digital-form-types";
import { FORM_WORKFLOWS, getFormWorkflow, getWorkflowForms } from "@/lib/form-library";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { DigitalApplicationWorkspace } from "@/components/digital-application-workspace";
import { InitialCertPicker } from "@/components/initial-cert-picker";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";

export const dynamic = "force-dynamic";
export const metadata = { title: "Initial Certification" };

function parseDetails(notes: string | null): DigitalApplicationDetails | null {
  if (!notes) return null;
  try { const details = JSON.parse(notes) as DigitalApplicationDetails; return details.requestKind === "digital_application_packet" ? details : null; } catch { return null; }
}

export default async function FormsPage({ searchParams }: { searchParams: { credential?: string; workflow?: string } }) {
  const memberId = await requireUserId();
  const credential = (searchParams.credential ?? "").toUpperCase();
  const requestedKey = searchParams.workflow ?? (credential ? `initial:${credential.toLowerCase()}` : "");
  const workflow = getFormWorkflow(requestedKey);
  if (!workflow) {
    const otherWorkflows = FORM_WORKFLOWS.filter((item) => item.category !== "initial");
    return (
      <>
        <PageHero
          eyebrow="Member Portal"
          title="Initial Certification"
          intro="Apply for your first ABCAC credential. Arizona residency for one year immediately prior to application is required, and every applicant must be approved for and pass the written IC&RC examination."
        />
        <Section>
          <div className="mb-8 rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-2xl">How initial certification works</h2>
            <ol className="mt-4 grid gap-4 text-sm text-muted sm:grid-cols-2 lg:grid-cols-4">
              <li className="rounded-xl border border-line bg-bg p-4"><span className="block text-lg font-bold text-brand">1. Apply</span>Choose your credential below and complete the digital application packet — education, experience, background, and ethics.</li>
              <li className="rounded-xl border border-line bg-bg p-4"><span className="block text-lg font-bold text-brand">2. Sign &amp; document</span>Invite supervisors and evaluators to sign their sections electronically, and upload transcripts and certificates in Documents.</li>
              <li className="rounded-xl border border-line bg-bg p-4"><span className="block text-lg font-bold text-brand">3. Pay &amp; review</span>Pay the application fee in Payments. ABCAC reviews your packet and approves you for the written exam.</li>
              <li className="rounded-xl border border-line bg-bg p-4"><span className="block text-lg font-bold text-brand">4. Test &amp; certify</span>Pass the IC&amp;RC exam and your credential is issued — your certificate and wallet card appear right in this portal.</li>
            </ol>
          </div>

          <InitialCertPicker />

          <div className="mt-10 rounded-2xl border border-line bg-bg p-6">
            <h2 className="text-lg font-semibold text-ink">Looking for a different form?</h2>
            <p className="mt-1 text-sm text-muted">Renewals, board, CEU workshop, and testing forms live in their own workflows:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {otherWorkflows.map((item) => (
                <Link key={item.key} href={`/account/forms?workflow=${encodeURIComponent(item.key)}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand/40 hover:text-brand">
                  <FileText className="h-4 w-4 text-brand" aria-hidden />{item.shortTitle}
                </Link>
              ))}
            </div>
          </div>
        </Section>
      </>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: applications } = await admin.from("applications").select("id,status,member_notes").eq("member_id", memberId).eq("app_type", workflow.appType).eq("cert_type", workflow.certType).in("status", ["draft", "submitted"]).order("submitted_at", { ascending: false }).limit(5);
  const application = (applications ?? []).find((row) => parseDetails(row.member_notes));
  const details = parseDetails(application?.member_notes ?? null);
  const { data: signers } = application?.id ? await admin.from("application_signer_requests").select("id,form_key,signer_role,signer_name,signer_email,status,signed_at,annotations").eq("application_id", application.id).order("created_at") : { data: [] };
  const packet = getWorkflowForms(workflow);

  return <><PageHero eyebrow="Digital application" title={workflow.title} intro="Complete the unchanged ABCAC forms online, save your draft, return later, and invite supervisors or attestors when their signatures are required." /><Section><DigitalApplicationWorkspace workflowKey={workflow.key} workflowTitle={workflow.title} certType={workflow.certType} packet={packet} applicationId={application?.id ?? null} initialMode={details?.submissionMode ?? "digital"} initialStatus={application?.status ?? null} initialDocuments={details?.documents ?? []} initialPaperPath={details?.paperDocumentPath ?? null} initialPaperName={details?.paperFileName ?? null} signerRequests={signers ?? []} /></Section></>;
}
