import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { NotificationSettings, type AlertPrefs } from "@/components/notification-settings";
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
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", user!.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("member_id", user!.id).maybeSingle(),
  ]);

  const email = (profile as { email?: string | null } | null)?.email ?? user?.email ?? null;

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
        intro="Confirm your account email and control which alerts and reminders ABCAC sends you."
      />
      <Section compact>
        <NotificationSettings email={email} prefs={prefsData} />
      </Section>
    </>
  );
}
