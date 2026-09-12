import { createHash } from "crypto";
import { notFound } from "next/navigation";
import type { FormAnnotation } from "@/lib/digital-form-types";
import { getFormDefinition } from "@/lib/form-library";
import { siteConfig } from "@/lib/site-config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { SignerFormWorkspace } from "./signer-form-workspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure Form Signature" };

export default async function SignApplicationPage({ params }: { params: { token: string } }) {
  const tokenHash = createHash("sha256").update(params.token).digest("hex");
  const admin = createSupabaseAdminClient();
  const { data: request } = await admin.from("application_signer_requests").select("id,form_key,signer_role,signer_name,status,annotations,signature_name,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (!request) notFound();
  if (request.status === "revoked") {
    return (
      <StatusPage tone="warn" title="This request was withdrawn">
        The applicant withdrew this signature request. If you believe this is a mistake, contact them directly, or reach ABCAC at{" "}
        <a className="font-semibold text-brand" href={siteConfig.contact.emailHref}>{siteConfig.contact.email}</a>.
      </StatusPage>
    );
  }
  if (new Date(request.expires_at).getTime() < Date.now()) {
    return (
      <StatusPage tone="warn" title="This secure link has expired">
        Signature links expire after a period of time to keep the applicant&apos;s information secure. Ask the applicant to resend an invitation from their portal, or contact ABCAC at{" "}
        <a className="font-semibold text-brand" href={siteConfig.contact.emailHref}>{siteConfig.contact.email}</a> for help.
      </StatusPage>
    );
  }
  const form = getFormDefinition(request.form_key);
  if (!form) notFound();
  if (request.status === "invited") {
    await admin.from("application_signer_requests").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", request.id);
  }
  if (request.status === "signed") {
    return <StatusPage tone="success" title="Already submitted">Your signed section has already been securely delivered to ABCAC.</StatusPage>;
  }
  return <main className="min-h-screen bg-bg px-4 py-10 sm:px-6"><div className="mx-auto max-w-6xl"><SignerFormWorkspace token={params.token} form={form} signerName={request.signer_name} signerRole={request.signer_role} initialAnnotations={(request.annotations ?? []) as FormAnnotation[]} initialSignatureName={request.signature_name ?? ""} /></div></main>;
}

function StatusPage({ tone, title, children }: { tone: "success" | "warn"; title: string; children: React.ReactNode }) {
  const toneClass = tone === "success" ? "border-success/20 bg-success/10" : "border-amber-200 bg-amber-50";
  return (
    <main className="min-h-screen bg-bg px-5 py-20">
      <div className={`mx-auto max-w-2xl rounded-2xl border p-8 text-center ${toneClass}`}>
        {tone === "success" ? <CheckMark /> : <WarnMark />}
        <h1 className="mt-4 text-3xl">{title}</h1>
        <p className="mt-2 text-muted">{children}</p>
      </div>
    </main>
  );
}

function CheckMark() {
  return <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-2xl font-bold text-white">✓</div>;
}

function WarnMark() {
  return <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-2xl font-bold text-white">!</div>;
}
