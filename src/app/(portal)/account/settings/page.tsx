import { requireUserId } from "@/lib/auth/current-user";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { NotificationSettings, type AlertPrefs } from "@/components/notification-settings";
import { DirectoryListingSettings } from "@/components/directory-listing-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Account Settings" };
export const dynamic = "force-dynamic";

const DEFAULT_PREFS: AlertPrefs = {
  renewal_reminders: true,
  ceu_deadline_alerts: true,
  abcac_announcements: true,
  icrc_updates: false,
};

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient();
  const __authUserId = await requireUserId();

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("email, directory_opt_out").eq("id", __authUserId).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("member_id", __authUserId).maybeSingle(),
  ]);

  const profileRow = profile as { email?: string | null; directory_opt_out?: boolean | null } | null;
  const email = profileRow?.email ?? null;
  const directoryOptOut = profileRow?.directory_opt_out ?? false;

  const prefsData: AlertPrefs = prefs
    ? {
        renewal_reminders: prefs.renewal_reminders ?? true,
        ceu_deadline_alerts: prefs.ceu_deadline_alerts ?? true,
        abcac_announcements: prefs.abcac_announcements ?? true,
        icrc_updates: prefs.icrc_updates ?? false,
      }
    : DEFAULT_PREFS;

  return (
    <>
      <PageHero
        eyebrow="Member Portal"
        title="Account Settings"
        intro="Confirm your login email, control which alerts and reminders ABCAC sends you, and request account help."
      />
      <Section compact>
        <div className="space-y-6">
          <DirectoryListingSettings optOut={directoryOptOut} />
          <NotificationSettings email={email} prefs={prefsData} />
        </div>
      </Section>
    </>
  );
}
