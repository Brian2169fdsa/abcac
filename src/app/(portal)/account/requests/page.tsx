import { requireUserId } from "@/lib/auth/current-user";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { NameChangeForm, VerificationForm, ReciprocityForm, type VerifyCertOption } from "@/components/portal-forms";
import { ViewFileButton } from "@/components/view-file-button";
import { RequestsHistoryList, type RequestHistoryRow } from "@/components/account/requests-history-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const supabase = createSupabaseServerClient();
  const __authUserId = await requireUserId();
  const uid = __authUserId;

  const [{ data: profile }, { data: nc }, { data: ver }, { data: rec }, { data: certs }, { data: otherCerts }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name").eq("id", uid).maybeSingle(),
    supabase.from("name_change_requests").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
    supabase.from("verification_requests").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
    supabase.from("reciprocity_requests").select("*").eq("member_id", uid).order("submitted_at", { ascending: false }),
    supabase.from("certifications").select("id,cert_type,cert_number").eq("member_id", uid).order("issued_date", { ascending: false }),
    supabase.from("other_certifications").select("id,credential_title,issuing_board").eq("member_id", uid).order("issued_date", { ascending: false }),
  ]);
  const currentName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "";

  // Dynamic "Certification to verify" options: ALL member certs (issued + other).
  const certOptions: VerifyCertOption[] = [
    ...(certs ?? []).map((c) => ({
      value: `cert:${c.id}`,
      label: [c.cert_type, c.cert_number].filter(Boolean).join(" · "),
      certId: c.id as string,
    })),
    ...(otherCerts ?? []).map((c) => ({
      value: `other:${c.id}`,
      label: `${c.credential_title}${c.issuing_board ? ` (${c.issuing_board})` : ""}`,
      certId: null,
    })),
  ];

  const nameChangeRows: RequestHistoryRow[] = (nc ?? []).map((r) => ({
    id: r.id,
    label: <>→ {r.new_name}</>,
    status: r.status,
    submittedAt: r.submitted_at,
    trailing: r.doc_path ? (
      <ViewFileButton bucket="name-change-docs" path={r.doc_path} label="View ID" />
    ) : undefined,
  }));

  const verificationRows: RequestHistoryRow[] = (ver ?? []).map((r) => ({
    id: r.id,
    label: `${r.purpose} → ${r.recipient_name}`,
    status: r.status,
    submittedAt: r.submitted_at,
  }));

  const reciprocityRows: RequestHistoryRow[] = (rec ?? []).map((r) => {
    const dir =
      r.direction === "out_of_az" ? "OUT of AZ" : r.direction === "into_az" ? "INTO AZ" : r.direction ?? "";
    const pay =
      r.direction === "out_of_az" && r.payment_status && r.payment_status !== "none"
        ? ` · fee ${r.payment_status}`
        : "";
    return {
      id: r.id,
      label: `${dir}: ${r.credential ?? "Credential"} → ${r.destination ?? ""}${pay}`,
      status: r.status,
      submittedAt: r.submitted_at,
    };
  });

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Requests" intro="Submit a name change, request a verification of certification, or start an IC&RC reciprocity transfer." />

      <Section compact id="name-change" title="Name Change">
        <div className="rounded-xl border border-line bg-surface p-6">
          <NameChangeForm currentName={currentName} />
          <RequestsHistoryList
            title="Submitted name changes"
            rows={nameChangeRows}
            emptyLabel="No name change requests submitted yet."
          />
        </div>
      </Section>

      <Section compact surface id="verification" title="Verification of Certification">
        <div className="rounded-xl border border-line bg-surface p-6">
          <VerificationForm certOptions={certOptions} />
          <RequestsHistoryList
            title="Verification requests"
            rows={verificationRows}
            emptyLabel="No verification requests submitted yet."
          />
        </div>
      </Section>

      <Section compact id="reciprocity" title="IC&RC Reciprocity">
        <div className="rounded-xl border border-line bg-surface p-6">
          <ReciprocityForm />
          <RequestsHistoryList
            title="Reciprocity transfers"
            rows={reciprocityRows}
            emptyLabel="No reciprocity transfers started yet."
          />
        </div>
      </Section>
    </>
  );
}
