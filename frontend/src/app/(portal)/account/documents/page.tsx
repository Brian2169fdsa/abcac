import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { DocumentUpload } from "@/components/document-upload";
import { ViewFileButton } from "@/components/view-file-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

interface Doc {
  id: string; document_type: string | null; file_name: string | null; file_path: string | null;
  uploaded_at: string | null; status: string | null;
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export default async function DocumentsPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("documents").select("*").eq("member_id", user!.id).order("uploaded_at", { ascending: false });
  const docs = (data as Doc[]) ?? [];

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Documents" intro="Upload supporting documents and view anything you've submitted. Files are stored privately and reviewed by ABCAC." />
      <Section compact>
        {docs.length === 0 ? (
          <p className="text-muted">No documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Document</th><th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Uploaded</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">View</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold text-ink">{d.file_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{d.document_type ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{fmt(d.uploaded_at)}</td>
                    <td className="px-4 py-3 capitalize text-muted">{d.status ?? "—"}</td>
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
