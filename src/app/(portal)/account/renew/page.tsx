import { optionalUserId } from "@/lib/auth/current-user";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { MemberApplicationForm } from "@/components/member-application-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Recertification" };
export const dynamic = "force-dynamic";

export default async function RenewPage() {
  const supabase = createSupabaseServerClient();
  const userId = optionalUserId();
  let name = "there";
  if (userId) {
    const { data: p } = await supabase.from("profiles").select("first_name").eq("id", userId).maybeSingle();
    if (p?.first_name) name = p.first_name;
  }

  return (
    <>
      <PageHero eyebrow="Recertification" title="Submit Your Recertification" intro="Report your continuing education and upload your CE certificates. All ABCAC credentials renew every two years.">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to account
        </Link>
      </PageHero>
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="text-muted">
            <p>Recertification requires your Ethics and Cultural Diversity hours plus continuing education in your field.</p>
            <p className="mt-3">Need to pay the $150 renewal fee? <Link href="/store/certification-renewal-2-year-credential-renewal-fee" className="font-semibold text-brand">Pay it here</Link>, then submit this form.</p>
          </div>
          <MemberApplicationForm mode="renewal" prefillName={name} />
        </div>
      </Section>
    </>
  );
}
