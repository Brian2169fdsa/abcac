import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { MemberApplicationForm } from "@/components/member-application-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Apply for Certification" };
export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  let name = "there";
  if (user) {
    const { data: p } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
    if (p?.first_name) name = p.first_name;
  }

  return (
    <>
      <PageHero eyebrow="Certification" title="Apply for Certification" intro="Submit your application and supporting documents online. ABCAC reviews applications within 10–15 business days.">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to account
        </Link>
      </PageHero>
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div className="text-muted">
            <p>Already paid your application &amp; exam fee? Complete this form to begin your review.</p>
            <p className="mt-3">Haven&apos;t paid yet? <Link href="/initial-certification" className="font-semibold text-brand">Start on the certification page</Link> first.</p>
          </div>
          <MemberApplicationForm mode="initial" prefillName={name} />
        </div>
      </Section>
    </>
  );
}
