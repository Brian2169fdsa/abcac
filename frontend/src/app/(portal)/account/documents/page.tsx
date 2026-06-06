import { Check, AlertCircle } from "lucide-react";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { DocumentUpload } from "@/components/document-upload";
import { ViewFileButton } from "@/components/view-file-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

interface Doc {
  id: string; document_type: string | null; file_name: string | null; file_path: string | null;
  uploaded_at: string | null; status: string | null; admin_notes: string | null;
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function badgeClass(s: string | null) {
  if (s === "approved") return "text-success";
  if (s === "rejected") return "text-red-600";
  return "text-amber-600";
}

// Common documents requested during certification — tracked against uploads.
const CHECKLIST = [
  { label: "Government Photo ID", match: "id" },
  { label: "Education Verification (transcript)", match: "education" },
  { label: "Experience Documentation (hours log)", match: "experience" },
  { label: "Training Verification (certificate)", match: "training" },
];

export default async function DocumentsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("documents").select("*").eq("member_id", user!.id).order("uploaded_at", { ascending: false });
  const docs = (data as Doc[]) ?? [];

  const checklist = CHECKLIST.map((item) => {
    const match = docs.find((d) => (d.document_type ?? "").toLowerCase().includes(item.match));
    return { ...item, status: match?.status ?? null, present: Boolean(match) };
  });

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Documents" intro="Upload supporting documents and track ABCAC's review. Files are stored privately and only visible to you and ABCAC staff." />

      {/* Tracking checklist */}
      <Section compact title="Document checklist">
        <p className="mb-4 max-w-3xl text-sm text-muted">Common documents requested during certification. Upload anything still marked “Needed.”</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {checklist.map((c) => (
            <div key={c.label} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
              {c.present ? <Check className="h-5 w-5 flex-shrink-0 text-success" aria-hidden /> : <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />}
              <div className="flex-1">
                <div className="text-sm font-semibold">{c.label}</div>
                <div className={`text-xs capitalize ${c.present ? badgeClass(c.status) : "text-muted"}`}>
                  {c.present ? c.status ?? "submitted" : "Needed"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section compact title="Your documents">
        {docs.length === 0 ? (
          <p className="text-muted">No documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Document</th><th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Uploaded</th><th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Review notes</th><th className="px-4 py-3">View</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{d.file_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{d.document_type ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(d.uploaded_at)}</td>
                    <td className={`px-4 py-3 font-semibold capitalize ${badgeClass(d.status)}`}>{d.status ?? "pending"}</td>
                    <td className="px-4 py-3 text-muted">{d.admin_notes ?? "—"}</td>
                    <td className="px-4 py-3">{d.file_path ? <ViewFileButton bucket="member-documents" path={d.file_path} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section compact><DocumentUpload /></Section>
    </>
  );
}
