import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { ProfileForm, type ProfileData, type Prefs } from "@/components/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile & Settings" };
export const dynamic = "force-dynamic";

const DEFAULT_PREFS: Prefs = {
  renewal_reminders: true, ceu_deadline_alerts: true, abcac_announcements: true, icrc_updates: false,
};

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name,email,phone,address_line1,city,state,zip_code").eq("id", user!.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("member_id", user!.id).maybeSingle(),
  ]);

  const profileData: ProfileData = (profile as ProfileData) ?? {
    first_name: null, last_name: null, email: user?.email ?? null, phone: null,
    address_line1: null, city: null, state: null, zip_code: null,
  };
  const prefsData: Prefs = prefs
    ? {
        renewal_reminders: prefs.renewal_reminders ?? true,
        ceu_deadline_alerts: prefs.ceu_deadline_alerts ?? true,
        abcac_announcements: prefs.abcac_announcements ?? true,
        icrc_updates: prefs.icrc_updates ?? false,
      }
    : DEFAULT_PREFS;

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Profile & Settings" intro="Update your contact information, notification preferences, and password." />
      <Section compact>
        <ProfileForm profile={profileData} prefs={prefsData} />
      </Section>
    </>
  );
}
