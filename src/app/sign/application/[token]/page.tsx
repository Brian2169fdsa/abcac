import { createHash } from "crypto";
import { notFound } from "next/navigation";
import type { FormAnnotation } from "@/lib/digital-form-types";
import { getFormDefinition } from "@/lib/form-library";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { SignerFormWorkspace } from "./signer-form-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure Form Signature" };

export default async function SignApplicationPage({ params }: { params: { token: string } }) {
  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const admin = createSupabaseAdminClient();
  const { data: request } = await admin.from("application_signer_requests").select("id,form_key,signer_role,signer_name,status,annotations,signature_name,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (!request || request.status === "revoked" || new Date(request.expires_at).getTime() < Date.now()) notFound();
  const form = getFormDefinition(request.form_key);
  if (!form) notFound();
  if (request.status === "invited") {
    await admin.from("application_signer_requests").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", request.id);
  }
  if (request.status === "signed") {
    return <main className="min-h-screen bg-bg px-5 py-20"><div className="mx-auto max-w-2xl rounded-2xl border border-success/20 bg-success/10 p-8 text-center"><CheckMark /><h1 className="mt-4 text-3xl">Already submitted</h1><p className="mt-2 text-muted">Your signed section has already been securely delivered to ABCAC.</p></div></main>;
  }
  return <main className="min-h-screen bg-bg px-4 py-10 sm:px-6"><div className="mx-auto max-w-6xl"><SignerFormWorkspace token={params.token} form={form} signerName={request.signer_name} signerRole={request.signer_role} initialAnnotations={(request.annotations ?? []) as FormAnnotation[]} initialSignatureName={request.signature_name ?? ""} /></div></main>;
}

function CheckMark() {
  return <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-2xl font-bold text-white">✓</div>;
}
