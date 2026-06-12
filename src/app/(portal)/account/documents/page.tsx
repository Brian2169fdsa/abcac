import { requireUserId } from "@/lib/auth/current-user";
import { Check, AlertCircle } from "lucide-react";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { OpenRequestsUpload } from "@/components/account/open-requests-upload";
import { SectionCard, EmptyState } from "@/components/account/section-card";
import { DocumentRow } from "@/components/account/documents-list-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

interface Doc {
  id: string; document_type: string | null; related_cert: string | null; file_name: string | null; file_path: string | null;
  uploaded_at: string | null; status: string | null; admin_notes: string | null;
}

interface DocumentRequest {
  id: string;
  document_type: string;
  note: string | null;
  created_at: string | null;
}
function badgeClass(s: string | null) {
  if (s === "approved") return "text-success";
  if (s === "rejected") return "text-red-600";
  return "text-amber-600";
}

// Document requirements, adapted to the member's most recent application
// credential. Falls back to a sensible default set.
const ID_ITEM = { label: "Government Photo ID", match: "id" };
const EDU_ITEM = { label: "Education Verification (transcript)", match: "education" };
const EXP_ITEM = { label: "Experience Documentation (hours log)", match: "experience" };
const TRAIN_ITEM = { label: "Training Verification (certificate)", match: "training" };
const SUP_ITEM = { label: "Clinical Supervision Documentation", match: "supervision" };

const DEFAULT_CHECKLIST = [ID_ITEM, EDU_ITEM, EXP_ITEM, TRAIN_ITEM];

const CREDENTIAL_CHECKLIST: Record<string, { label: string; match: string }[]> = {
  CAC: [ID_ITEM, EDU_ITEM, EXP_ITEM],
  CADAC: [ID_ITEM, EDU_ITEM, EXP_ITEM],
  AADC: [ID_ITEM, EDU_ITEM, EXP_ITEM],
  CCS: [ID_ITEM, EDU_ITEM, EXP_ITEM, SUP_ITEM],
  CCJP: [ID_ITEM, EDU_ITEM, EXP_ITEM],
  CPRS: [ID_ITEM, EDU_ITEM, EXP_ITEM, TRAIN_ITEM],
  CPS: [ID_ITEM, EDU_ITEM, EXP_ITEM, TRAIN_ITEM],
};

export default async function DocumentsPage() {
  const supabase = createSupabaseServerClient();
  const __authUserId = await requireUserId();
  const [{ data }, { data: latestApp }, { data: openReqData }] = await Promise.all([
    supabase.from("documents").select("*").eq("member_id", __authUserId).order("uploaded_at", { ascending: false }),
    supabase.from("applications").select("cert_type").eq("member_id", __authUserId).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("document_requests").select("id,document_type,note,created_at").eq("member_id", __authUserId).eq("status", "open").order("created_at", { ascending: false }),
  ]);
  const docs = (data as Doc[]) ?? [];
  const openRequests = (openReqData as DocumentRequest[]) ?? [];
  const credential: string | null = (latestApp?.cert_type as string | null) ?? null;
  const requiredDocs = (credential && CREDENTIAL_CHECKLIST[credential]) || DEFAULT_CHECKLIST;

  const checklist = requiredDocs.map((item: { label: string; match: string }) => {
    const match = docs.find((d) => (d.document_type ?? "").toLowerCase().includes(item.match));
    return { ...item, status: match?.status ?? null, present: Boolean(match) };
  });

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Documents" intro="Upload supporting documents and track ABCAC's review. Files are stored privately and only visible to you and ABCAC staff." />

      {/* Tracking checklist */}
      <Section compact title="Document checklist">
        <SectionCard
          title="Required documents"
          description={
            credential
              ? `Documents typically required for your ${credential} application. Upload anything still marked “Needed.”`
              : "Common documents requested during certification. Upload anything still marked “Needed.”"
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {checklist.map((c) => (
              <div key={c.label} className="flex items-center gap-3 rounded-lg border border-line bg-bg p-4">
                {c.present ? <Check className="h-5 w-5 flex-shrink-0 text-success" aria-hidden /> : <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />}
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">{c.label}</div>
                  <div className={`text-xs capitalize ${c.present ? badgeClass(c.status) : "text-muted"}`}>
                    {c.present ? c.status ?? "submitted" : "Needed"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </Section>

      <Section compact title="Your documents">
        <SectionCard title="Uploaded documents">
          {docs.length === 0 ? (
            <EmptyState>No documents uploaded yet. Use the upload form below to add your first file.</EmptyState>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <DocumentRow key={d.id} doc={d} />
              ))}
            </div>
          )}
        </SectionCard>
      </Section>

      <OpenRequestsUpload openRequests={openRequests} />
    </>
  );
}
