import { requireUserId } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { OnboardingFlow, type OnboardingProfile } from "@/components/onboarding-flow";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Complete Your Registration" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();
  const __authUserId = await requireUserId();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,phone,date_of_birth,address_line1,city,state,zip_code,account_status,account_submitted_at,account_review_notes")
    .eq("id", __authUserId)
    .maybeSingle();

  // Approved members don't need onboarding.
  if (profile?.account_status === "approved") redirect("/account");

  return (
    <>
      <PageHero
        eyebrow="Welcome to ABCAC"
        title="Complete your registration"
        intro="Tell us about yourself and the certifications you hold. ABCAC staff will review and approve your account."
      />
      <Section compact>
        <div className="mx-auto max-w-3xl">
          <OnboardingFlow profile={(profile as OnboardingProfile) ?? ({} as OnboardingProfile)} />
        </div>
      </Section>
    </>
  );
}
