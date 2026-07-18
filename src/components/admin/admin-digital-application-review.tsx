"use client";

import { useMemo, useState } from "react";
import { DigitalPdfEditor } from "@/components/digital-pdf-editor";
import type { DigitalFormDocument, FormAnnotation } from "@/lib/digital-form-types";
import type { FormDefinition } from "@/lib/form-library";

export function AdminDigitalApplicationReview({
  forms,
  documents,
  signerAnnotations,
}: {
  forms: FormDefinition[];
  documents: DigitalFormDocument[];
  signerAnnotations: Array<{ formKey: string; annotations: FormAnnotation[] }>;
}) {
  const [activeKey, setActiveKey] = useState(forms[0]?.key ?? "");
  const activeForm = forms.find((form) => form.key === activeKey) ?? forms[0];
  const annotations = useMemo(() => [
    ...(documents.find((document) => document.formKey === activeKey)?.annotations ?? []),
    ...signerAnnotations.filter((entry) => entry.formKey === activeKey).flatMap((entry) => entry.annotations),
  ], [activeKey, documents, signerAnnotations]);
  if (!activeForm) return null;
  return <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6"><div className="mb-5 flex flex-wrap gap-2">{forms.map((form) => <button key={form.key} type="button" onClick={() => setActiveKey(form.key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeKey === form.key ? "bg-info text-white" : "border border-line bg-bg text-ink"}`}>{form.shortTitle}</button>)}</div><DigitalPdfEditor form={activeForm} annotations={annotations} onChange={() => undefined} signatureName="" onSignatureNameChange={() => undefined} readOnly /></div>;
}
