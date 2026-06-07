import Link from "next/link";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { ProfileForm, type ProfileData, type Prefs } from "@/components/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExportButton } from "@/components/account/export-button";

function title(s: string | null) {
  return (s ?? "").replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export const metadata = { title: "Profile & Settings" };
export const dynamic = "force-dynamic";

const DEFAULT_PREFS: Prefs = {
  renewal_reminders: true, ceu_deadline_alerts: true, abcac_announcements: true, icrc_updates: false,
};

export default async function ProfilePage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("first_name,middle_name,last_name,email,phone,date_of_birth,ssn_last4,address_line1,city,state,zip_code,cert_status").eq("id", user!.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("member_id", user!.id).maybeSingle(),
  ]);

  const profileData: ProfileData = (profile as ProfileData) ?? {
    first_name: null, middle_name: null, last_name: null, email: user?.email ?? null, phone: null,
    date_of_birth: null, ssn_last4: null, address_line1: null, city: null, state: null, zip_code: null,
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
        <div className="rounded-xl border border-line bg-surface p-6">
          <h3 className="mb-4">Account</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><div className="text-xs uppercase tracking-wide text-muted">Login email</div><div className="mt-1 font-semibold text-ink">{profileData.email ?? "—"}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Certification status</div><div className="mt-1 font-semibold text-ink">{title((profile as { cert_status?: string | null })?.cert_status ?? "applying")}</div></div>
            <div className="flex items-end"><Link href="/logout" className="font-semibold text-brand hover:text-brand-600">Sign out</Link></div>
          </div>
        </div>
      </Section>

      <Section compact>
        <ProfileForm profile={profileData} prefs={prefsData} />
      </Section>

      <Section compact>
        <div className="rounded-xl border border-line bg-surface p-6">
          <h3 className="mb-4">Your data</h3>
          <p className="mb-4 text-muted">Download a copy of your ABCAC portal data.</p>
          <ExportButton />
        </div>
      </Section>
    </>
  );
}
