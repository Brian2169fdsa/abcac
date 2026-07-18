import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { requireUserId } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CertificationSyncForm } from "./certification-sync-form";

export const metadata = { title: "Certification Sync Request" };
export const dynamic = "force-dynamic";

export default async function CertificationSyncAccountPage({ searchParams }: { searchParams?: { mode?: string } }) {
  const memberId = await requireUserId();
  const supabase = createSupabaseServerClient();
  const [{ data: profile }, { data: request }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name,phone").eq("id", memberId).maybeSingle(),
    supabase.from("applications").select("id,status,member_notes,signature_name").eq("member_id", memberId).eq("app_type", "cert_sync").in("status", ["draft", "submitted", "under_review"]).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return (
    <>
      <PageHero eyebrow="Certification management" title="Certification Sync Request" intro="Save your request, return later, upload a paper form if preferred, and complete the one-time synchronization payment." />
      <Section compact>
        <div className="mx-auto max-w-5xl">
          <CertificationSyncForm
            request={request ?? null}
            preferredMode={searchParams?.mode === "paper" ? "paper" : "digital"}
            profile={{ fullName, phone: profile?.phone ?? "" }}
          />
        </div>
      </Section>
    </>
  );
}
