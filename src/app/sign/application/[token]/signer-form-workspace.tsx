"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { DigitalPdfEditor } from "@/components/digital-pdf-editor";
import { Button } from "@/components/ui/button";
import type { FormAnnotation } from "@/lib/digital-form-types";
import type { FormDefinition } from "@/lib/form-library";
import { saveSignerForm } from "./actions";

export function SignerFormWorkspace({
  token,
  form,
  signerName,
  signerRole,
  initialAnnotations,
  initialSignatureName,
}: {
  token: string;
  form: FormDefinition;
  signerName: string;
  signerRole: string;
  initialAnnotations: FormAnnotation[];
  initialSignatureName: string;
}) {
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [signatureName, setSignatureName] = useState(initialSignatureName || signerName);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function save(final: boolean) {
    setBusy(final ? "submit" : "save");
    setError(null);
    setMessage(null);
    const result = await saveSignerForm({ token, annotations, signatureName, final, consent });
    if (!result.ok) setError(result.error);
    else {
      setMessage(result.message);
      if (final) setComplete(true);
    }
    setBusy(null);
  }

  if (complete) {
    return <div className="mx-auto max-w-2xl rounded-2xl border border-success/20 bg-success/10 p-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-success" /><h2 className="mt-4">Signature submitted</h2><p className="mt-2 text-muted">ABCAC and the applicant can now review your completed {signerRole} section. You may close this window.</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-5"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Private signer request</p><h1 className="mt-1 text-3xl">{form.title}</h1><p className="mt-2 text-muted">Complete only the sections assigned to you as <strong>{signerRole}</strong>. Your marks are saved separately from the applicant&apos;s work.</p></div>
      <DigitalPdfEditor form={form} annotations={annotations} onChange={setAnnotations} author="signer" signatureName={signatureName} onSignatureNameChange={setSignatureName} />
      <label className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4" /><span>I, <strong>{signatureName || signerName}</strong>, confirm that the information I entered is true and that typing and placing my name on this form is my electronic signature.</span></label>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
      {message && <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm font-semibold text-success">{message}</div>}
      <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" size="lg" disabled={busy !== null} onClick={() => save(false)}>{busy === "save" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save progress"}</Button><Button type="button" size="lg" disabled={busy !== null} onClick={() => save(true)}>{busy === "submit" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign and submit"}</Button></div>
    </div>
  );
}
