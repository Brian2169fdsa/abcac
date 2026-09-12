import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/current-user";
import type { DigitalApplicationDetails } from "@/lib/digital-form-types";
import { IN_FLIGHT_APPLICATION_STATUSES, getFormWorkflow, getWorkflowForms } from "@/lib/form-library";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { DigitalApplicationWorkspace } from "@/components/digital-application-workspace";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applications & Forms" };

function parseDetails(notes: string | null): DigitalApplicationDetails | null {
  if (!notes) return null;
  try { const details = JSON.parse(notes) as DigitalApplicationDetails; return details.requestKind === "digital_application_packet" ? details : null; } catch { return null; }
}

export default async function FormsPage({ searchParams }: { searchParams: { credential?: string; workflow?: string; application?: string; new?: string; testingRequestId?: string } }) {
  const memberId = await requireUserId();
  const credential = (searchParams.credential ?? "").toUpperCase();
  const requestedKey = searchParams.workflow ?? (credential ? `initial:${credential.toLowerCase()}` : "");
  const workflow = getFormWorkflow(requestedKey);
  // No workflow selected: the Certification hub is the single place to choose
  // initial vs recertification and the credential (it replaces the old picker
  // landing that duplicated the hub).
  if (!workflow) redirect("/account/certification");

  const admin = createSupabaseAdminClient();
  // Every packet for this workflow, ANY status. Drafts carry a null submitted_at
  // and sort first; submitted/reviewed packets follow newest-first. The member
  // must always be able to see the packet they paid for — the old draft|submitted
  // filter hid it the moment the webhook moved it to under_review, and offered a
  // blank duplicate instead.
  const { data: rows } = await admin
    .from("applications")
    .select("id,status,member_notes,submitted_at,reviewed_at,admin_notes,est_completion,testing_request_id")
    .eq("member_id", memberId)
    .eq("app_type", workflow.appType)
    .eq("cert_type", workflow.certType)
    .order("submitted_at", { ascending: false, nullsFirst: true })
    .limit(10);
  const packets = (rows ?? []).filter((row) => parseDetails(row.member_notes));

  // ?application=<id> opens a specific packet (from Application Status).
  // ?new=1 explicitly starts a fresh packet — allowed only when nothing for this
  // workflow is still in flight, so a member cannot file a duplicate by accident.
  const requestedId = searchParams.application ?? "";
  const inFlight = packets.find((row) => (IN_FLIGHT_APPLICATION_STATUSES as readonly string[]).includes(row.status ?? ""));
  const startNew = searchParams.new === "1" && !inFlight;
  const application = startNew
    ? null
    : (requestedId && packets.find((row) => row.id === requestedId)) ||
      packets.find((row) => row.status === "draft") ||
      inFlight ||
      packets[0] ||
      null;
  const details = parseDetails(application?.member_notes ?? null);

  const [{ data: signers }, { data: paidSubmissions }] = application?.id
    ? await Promise.all([
        admin.from("application_signer_requests").select("id,form_key,signer_role,signer_name,signer_email,status,signed_at,annotations").eq("application_id", application.id).order("created_at"),
        admin.from("payment_submissions").select("id").eq("member_id", memberId).eq("linked_record_type", "applications").eq("linked_record_id", application.id).eq("status", "paid").limit(1),
      ])
    : [{ data: [] }, { data: [] }];
  const feePaid = (paidSubmissions ?? []).length > 0;
  const packet = getWorkflowForms(workflow);
  const canStartNew = !inFlight && Boolean(application) && application?.status !== "draft";

  // testing:accommodations only — offer the member's own exam pre-registrations
  // so this request can be linked to the specific one it is for.
  let testingRequests: Array<{ id: string; examCode: string; testingMode: string; status: string }> = [];
  let initialTestingRequestId: string | null = null;
  if (workflow.appType === "testing_accommodations") {
    const { data: memberTestingRequests } = await admin
      .from("testing_requests")
      .select("id,exam_code,testing_mode,status")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    testingRequests = (memberTestingRequests ?? []).map((r) => ({ id: r.id, examCode: r.exam_code, testingMode: r.testing_mode, status: r.status }));
    const requestedTestingRequestId = searchParams.testingRequestId ?? "";
    initialTestingRequestId =
      (application as { testing_request_id?: string | null } | null)?.testing_request_id ??
      (requestedTestingRequestId && testingRequests.some((r) => r.id === requestedTestingRequestId) ? requestedTestingRequestId : null);
  }

  return (
    <>
      <PageHero eyebrow="Digital application" title={workflow.title} intro="Complete the unchanged ABCAC forms online, save your draft, return later, and invite supervisors or attestors when their signatures are required." />
      <Section>
        <DigitalApplicationWorkspace
          workflowKey={workflow.key}
          workflowTitle={workflow.title}
          certType={workflow.certType}
          packet={packet}
          applicationId={application?.id ?? null}
          initialMode={details?.submissionMode ?? "digital"}
          initialStatus={application?.status ?? null}
          initialDocuments={details?.documents ?? []}
          initialPaperPath={details?.paperDocumentPath ?? null}
          initialPaperName={details?.paperFileName ?? null}
          signerRequests={signers ?? []}
          feePaid={feePaid}
          reviewNotes={application?.admin_notes ?? null}
          submittedAt={application?.submitted_at ?? null}
          canStartNew={canStartNew}
          otherPackets={packets.filter((row) => row.id !== application?.id).map((row) => ({ id: row.id, status: row.status ?? "draft", submittedAt: row.submitted_at ?? null }))}
          testingRequests={testingRequests}
          initialTestingRequestId={initialTestingRequestId}
        />
      </Section>
    </>
  );
}
