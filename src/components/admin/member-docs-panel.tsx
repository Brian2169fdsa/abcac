import { ViewFileButton } from "@/components/view-file-button";

/** Shape of a `documents` row this panel needs (loose — page passes raw rows). */
export interface MemberDoc {
  id?: string | number;
  document_type?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  status?: string | null;
  uploaded_at?: string | null;
}

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

function StatusChip({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toLowerCase();
  const tone =
    s === "approved" || s === "verified" || s === "fulfilled" || s === "completed"
      ? "bg-success/15 text-success"
      : s === "rejected" || s === "not_verified" || s === "expired"
        ? "bg-brand/15 text-brand"
        : "bg-accent/10 text-info";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${tone}`}>
      {(status ?? "—").replace(/_/g, " ") || "—"}
    </span>
  );
}

/**
 * Cockpit panel: every document this member has on file, with a signed-URL
 * "View" action (reuses ViewFileButton → supabase storage createSignedUrl).
 */
export function MemberDocsPanel({ documents }: { documents: MemberDoc[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Documents on file</h3>
        <span className="text-xs text-muted">{documents.length} total</span>
      </div>
      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-bg px-4 py-6 text-center text-sm text-muted">
          No documents on file for this member yet.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {documents.map((d, i) => (
            <li key={d.id ?? i} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{d.file_name || "Untitled document"}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="capitalize">{(d.document_type ?? "—").replace(/_/g, " ")}</span>
                  <span>Uploaded {fmt(d.uploaded_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusChip status={d.status} />
                {d.file_path ? (
                  <ViewFileButton bucket="member-documents" path={d.file_path} />
                ) : (
                  <span className="text-xs text-muted">No file</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
