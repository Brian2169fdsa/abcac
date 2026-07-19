import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUserId } from "@/lib/auth/current-user";
import type { DigitalApplicationDetails } from "@/lib/digital-form-types";
import { FORM_WORKFLOWS, getFormWorkflow, getWorkflowForms } from "@/lib/form-library";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { DigitalApplicationWorkspace } from "@/components/digital-application-workspace";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";

export const dynamic = "force-dynamic";
export const metadata = { title: "Digital Application Forms" };

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
    const groups = [
      { title: "Initial certification", workflows: FORM_WORKFLOWS.filter((item) => item.category === "initial") },
      { title: "Certification renewal", workflows: FORM_WORKFLOWS.filter((item) => item.category === "renewal") },
      { title: "Organization and board forms", workflows: FORM_WORKFLOWS.filter((item) => item.category === "board" || item.category === "ceu") },
      { title: "Testing forms", workflows: FORM_WORKFLOWS.filter((item) => item.category === "testing") },
    ];
    return <><PageHero eyebrow="Member Portal" title="ABCAC Digital Forms Center" intro="Complete the original ABCAC forms online, save your work, return later, or download and upload the paper packet." /><Section><div className="space-y-10">{groups.map((group) => <div key={group.title}><h2 className="mb-4 text-2xl">{group.title}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{group.workflows.map((item) => <Link key={item.key} href={`/account/forms?workflow=${encodeURIComponent(item.key)}`} className="group rounded-2xl border border-line bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"><FileText className="h-8 w-8 text-brand" /><h3 className="mt-4 text-xl">{item.shortTitle}</h3><p className="mt-2 text-sm text-muted">Open the exact {item.title} packet and save your work as you go.</p><span className="mt-5 inline-block text-sm font-semibold text-brand">Start form →</span></Link>)}</div></div>)}</div></Section></>;
  }

  const admin = createSupabaseAdminClient();
  const { data: applications } = await admin.from("applications").select("id,status,member_notes").eq("member_id", memberId).eq("app_type", workflow.appType).eq("cert_type", workflow.certType).in("status", ["draft", "submitted"]).order("submitted_at", { ascending: false }).limit(5);
  const application = (applications ?? []).find((row) => parseDetails(row.member_notes));
  const details = parseDetails(application?.member_notes ?? null);
  const { data: signers } = application?.id ? await admin.from("application_signer_requests").select("id,form_key,signer_role,signer_name,signer_email,status,signed_at").eq("application_id", application.id).order("created_at") : { data: [] };
  const packet = getWorkflowForms(workflow);

  return <><PageHero eyebrow="Digital application" title={workflow.title} intro="Complete the unchanged ABCAC forms online, save your draft, return later, and invite supervisors or attestors when their signatures are required." /><Section><DigitalApplicationWorkspace workflowKey={workflow.key} workflowTitle={workflow.title} certType={workflow.certType} packet={packet} applicationId={application?.id ?? null} initialMode={details?.submissionMode ?? "digital"} initialStatus={application?.status ?? null} initialDocuments={details?.documents ?? []} initialPaperPath={details?.paperDocumentPath ?? null} initialPaperName={details?.paperFileName ?? null} signerRequests={signers ?? []} /></Section></>;
}
