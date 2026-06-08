import { FileText } from "lucide-react";
import { ViewFileButton } from "@/components/view-file-button";
import { StatusChip } from "@/components/account/status-chip";

interface DocItem {
  id: string;
  document_type: string | null;
  related_cert: string | null;
  file_name: string | null;
  file_path: string | null;
  uploaded_at: string | null;
  status: string | null;
  admin_notes: string | null;
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

/**
 * Renders a single uploaded document as a brand-matched card row with a status
 * chip, metadata, optional review notes, and a view action.
 */
export function DocumentRow({ doc }: { doc: DocItem }) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-lg border border-line bg-bg p-4">
      <FileText className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{doc.file_name ?? "Document"}</span>
          <StatusChip status={doc.status ?? "pending"} />
        </div>
        <div className="mt-1 text-sm text-muted">
          {doc.document_type ?? "—"}
          {doc.related_cert ? ` (${doc.related_cert})` : ""} · Uploaded {fmt(doc.uploaded_at)}
        </div>
        {doc.admin_notes && (
          <div className="mt-2 rounded border border-line bg-surface px-3 py-2 text-sm text-muted">
            <span className="font-semibold text-ink">Review notes: </span>
            {doc.admin_notes}
          </div>
        )}
      </div>
      {doc.file_path && (
        <div className="flex-shrink-0">
          <ViewFileButton bucket="member-documents" path={doc.file_path} />
        </div>
      )}
    </div>
  );
}
