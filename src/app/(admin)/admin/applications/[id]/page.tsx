import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileCheck2 } from "lucide-react";
import { AdminDigitalApplicationReview } from "@/components/admin/admin-digital-application-review";
import { AppStatusControl } from "@/components/admin/app-status-control";
import { buttonVariants } from "@/components/ui/button";
import type { DigitalApplicationDetails, FormAnnotation } from "@/lib/digital-form-types";
import { getFormDefinition } from "@/lib/form-library";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseDetails(notes: string | null): DigitalApplicationDetails | null {
  if (!notes) return null;
  try { const details = JSON.parse(notes) as DigitalApplicationDetails; return details.requestKind === "digital_application_packet" ? details : null; } catch { return null; }
}

export default async function AdminApplicationDetail({ params }: { params: { id: string } }) {
  const admin = createSupabaseAdminClient();
  const { data: application } = await admin.from("applications").select("*, profiles(first_name,last_name,email)").eq("id", params.id).maybeSingle();
  if (!application) notFound();
  const details = parseDetails(application.member_notes);
  if (!details) notFound();
  const { data: signers } = await admin.from("application_signer_requests").select("id,form_key,signer_role,signer_name,signer_email,status,annotations,signature_name,signed_at").eq("application_id", application.id).order("created_at");
  const { data: paidFee } = await admin.from("payment_submissions").select("id,product_name,amount_cents,paid_at").eq("linked_record_type", "applications").eq("linked_record_id", application.id).eq("status", "paid").maybeSingle();
  const forms = details.documents.map((document) => getFormDefinition(document.formKey)).filter((form): form is NonNullable<typeof form> => Boolean(form));
  let paperUrl: string | null = null;
  if (details.paperDocumentPath) {
    const { data } = await admin.storage.from("member-documents").createSignedUrl(details.paperDocumentPath, 60 * 20);
    paperUrl = data?.signedUrl ?? null;
  }
  const name = [application.profiles?.first_name, application.profiles?.last_name].filter(Boolean).join(" ") || application.profiles?.email || "Member";

  return <div className="space-y-6"><Link href="/admin/applications" className="inline-flex items-center gap-2 text-sm font-semibold text-brand"><ArrowLeft className="h-4 w-4" />Back to applications</Link><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">{details.workflowTitle}</p><h1 className="mt-1 text-3xl">{name}</h1><p className="mt-2 text-muted">{application.profiles?.email} · {details.submissionMode === "digital" ? "Digital packet" : "Paper upload"}</p><p className="mt-3">{paidFee ? <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">Fee paid · {paidFee.product_name} · ${((paidFee.amount_cents ?? 0) / 100).toFixed(2)}</span> : <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">Application fee not yet paid</span>}</p></div><AppStatusControl id={application.id} status={application.status} /></div>
    {details.submissionMode === "paper" ? <div className="rounded-2xl border border-line bg-surface p-6"><FileCheck2 className="h-8 w-8 text-brand" /><h2 className="mt-3">Uploaded paper packet</h2><p className="mt-2 text-muted">{details.paperFileName ?? "Completed packet"}</p>{paperUrl && <Link href={paperUrl} target="_blank" className={`${buttonVariants({ variant: "outline" })} mt-5`}><Download className="h-4 w-4" />Open secure file</Link>}</div> : <AdminDigitalApplicationReview forms={forms} documents={details.documents} signerAnnotations={(signers ?? []).map((signer) => ({ formKey: signer.form_key, annotations: (signer.annotations ?? []) as FormAnnotation[] }))} />}
    <div className="rounded-2xl border border-line bg-surface p-6"><h2>Outside signer status</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{signers?.length ? signers.map((signer) => <div key={signer.id} className="rounded-xl border border-line bg-bg p-4"><p className="font-semibold">{signer.signer_name} · {signer.signer_role}</p><p className="mt-1 text-sm text-muted">{signer.signer_email}</p><p className="mt-2 text-sm font-semibold uppercase tracking-wide text-brand">{signer.status}{signer.signature_name ? ` · Signed by ${signer.signature_name}` : ""}</p></div>) : <p className="text-sm text-muted">No outside signers were invited.</p>}</div></div>
  </div>;
}
