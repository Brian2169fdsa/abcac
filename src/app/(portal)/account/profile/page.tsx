import { requireUserId } from "@/lib/auth/current-user";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { ProfileForm, type ProfileData, type Prefs } from "@/components/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExportButton } from "@/components/account/export-button";
import { StatusChip } from "@/components/account/status-chip";
import { ProfileCompleteness } from "@/components/account/profile-completeness";

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
  const __authUserId = await requireUserId();
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("first_name,middle_name,last_name,email,phone,date_of_birth,ssn_last4,address_line1,city,state,zip_code,cert_status").eq("id", __authUserId).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("member_id", __authUserId).maybeSingle(),
  ]);

  const profileData: ProfileData = (profile as ProfileData) ?? {
    first_name: null, middle_name: null, last_name: null, email: null, phone: null,
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

  const certStatus = (profile as { cert_status?: string | null })?.cert_status ?? "applying";

  // Key contact fields that signal a complete member profile.
  const completenessFields = [
    { label: "First name", value: profileData.first_name },
    { label: "Last name", value: profileData.last_name },
    { label: "Phone", value: profileData.phone },
    { label: "Date of birth", value: profileData.date_of_birth },
    { label: "Street address", value: profileData.address_line1 },
    { label: "City", value: profileData.city },
    { label: "State", value: profileData.state },
    { label: "ZIP code", value: profileData.zip_code },
  ];

  return (
    <>
      <PageHero eyebrow="Member Portal" title="Profile & Settings" intro="Update your contact information, notification preferences, and password." />

      <Section compact>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <h3 className="mb-4 font-display text-base font-bold text-ink">Account</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Login email</dt>
                <dd className="mt-1 font-semibold text-ink">{profileData.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Certification status</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <StatusChip status={title(certStatus)} />
                </dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-line pt-4">
              <SignOutButton className="text-left text-sm font-semibold text-brand hover:text-brand-600">
                Sign out
              </SignOutButton>
            </div>
          </div>

          <ProfileCompleteness fields={completenessFields} />
        </div>
      </Section>

      <Section compact>
        <ProfileForm profile={profileData} prefs={prefsData} />
      </Section>

      <Section compact>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h3 className="mb-2 font-display text-base font-bold text-ink">Your data</h3>
          <p className="mb-4 text-sm text-muted">Download a copy of your ABCAC portal data.</p>
          <ExportButton />
        </div>
      </Section>
    </>
  );
}
