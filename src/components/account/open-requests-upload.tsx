"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Section } from "@/components/section";
import { DocumentUpload, type OpenRequestOption } from "@/components/document-upload";
import { Button } from "@/components/ui/button";

export interface OpenRequest {
  id: string;
  document_type: string;
  note: string | null;
  created_at: string | null;
}

/**
 * Renders the "ABCAC requested these documents" banner together with the upload
 * form so a member can click "Upload this" on a specific request to pre-select
 * the matching document type, then upload — which auto-fulfills the request.
 */
export function OpenRequestsUpload({ openRequests }: { openRequests: OpenRequest[] }) {
  const [preselect, setPreselect] = useState<string>("");
  const requestTypes: OpenRequestOption[] = openRequests.map((r) => ({ id: r.id, document_type: r.document_type }));

  return (
    <>
      {openRequests.length > 0 && (
        <Section compact>
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />
              <span className="font-semibold text-amber-800">ABCAC has requested the following document{openRequests.length > 1 ? "s" : ""}:</span>
            </div>
            <ul className="mb-4 space-y-2">
              {openRequests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-white px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{r.document_type}</div>
                    {r.note && <div className="mt-0.5 text-sm text-muted">{r.note}</div>}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPreselect(r.document_type);
                      document.getElementById("upload-document")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    Upload this
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-sm text-amber-700">Please upload the requested document{openRequests.length > 1 ? "s" : ""} using the upload form below.</p>
          </div>
        </Section>
      )}

      <Section compact>
        <div id="upload-document">
          <DocumentUpload openRequestTypes={requestTypes} preselectType={preselect} />
        </div>
      </Section>
    </>
  );
}
