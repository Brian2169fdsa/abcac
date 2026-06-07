"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export interface AlertPrefs {
  renewal_reminders: boolean;
  ceu_deadline_alerts: boolean;
  abcac_announcements: boolean;
  icrc_updates: boolean;
}

const TOGGLES: {
  key: keyof AlertPrefs;
  label: string;
  help: string;
  gated: boolean;
}[] = [
  {
    key: "renewal_reminders",
    label: "Renewal reminders",
    help: "Email alerts at 90, 60 and 30 days before your certification expires.",
    gated: true,
  },
  {
    key: "ceu_deadline_alerts",
    label: "CEU deadline alerts",
    help: "Email alerts when you are behind on CEU hours within 60 days of renewal.",
    gated: true,
  },
  {
    key: "abcac_announcements",
    label: "ABCAC announcements",
    help: "General announcements and news posted to your portal inbox by ABCAC staff.",
    gated: false,
  },
  {
    key: "icrc_updates",
    label: "IC&RC updates",
    help: "Updates relating to IC&RC reciprocity and credentialing.",
    gated: false,
  },
];

export function NotificationSettings({
  email,
  prefs,
}: {
  email: string | null;
  prefs: AlertPrefs;
}) {
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function flash(m: string) {
    setMsg(m);
    setErr(null);
    setTimeout(() => setMsg(null), 3500);
  }

  async function savePrefs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    const f = e.currentTarget;
    const ck = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).checked;
    setSavingPrefs(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErr("Session expired — please sign in again.");
        return;
      }
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          member_id: user.id,
          renewal_reminders: ck("renewal_reminders"),
          ceu_deadline_alerts: ck("ceu_deadline_alerts"),
          abcac_announcements: ck("abcac_announcements"),
          icrc_updates: ck("icrc_updates"),
        },
        { onConflict: "member_id" },
      );
      if (error) {
        setErr("Could not save preferences. Please try again.");
        return;
      }
      flash("Notification preferences saved.");
    } finally {
      setSavingPrefs(false);
    }
  }

  const field =
    "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
  const toggle = "flex items-start justify-between gap-4 border-b border-line py-4 last:border-0";

  return (
    <div className="space-y-6">
      {msg && (
        <div className="rounded-lg border border-success/40 bg-success/5 px-4 py-2 text-sm text-success">{msg}</div>
      )}
      {err && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
      )}

      {/* Account email */}
      <div className="rounded-xl border border-line bg-surface p-6">
        <h3 className="mb-1">Account email</h3>
        <p className="mb-4 text-sm text-muted">
          Your login email. Email changes are managed by ABCAC sign-in (Supabase Auth) — to change it, contact
          ABCAC staff or use the “Send a message” option on the Messages page.
        </p>
        <label className="block max-w-md">
          <span className="mb-1.5 block text-sm font-semibold">Email address</span>
          <input className={field} value={email ?? ""} disabled aria-readonly />
        </label>
      </div>

      {/* Alert preferences */}
      <form onSubmit={savePrefs} className="rounded-xl border border-line bg-surface p-6">
        <h3 className="mb-1">Alerts &amp; notifications</h3>
        <p className="mb-2 text-sm text-muted">
          Choose which alerts you receive. Toggles marked “gates email reminders” actively turn the matching
          scheduled email on or off.
        </p>
        {TOGGLES.map((t) => (
          <div key={t.key} className={toggle}>
            <span className="flex-1">
              <span className="block text-sm font-semibold">
                {t.label}
                {t.gated && (
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    gates email reminders
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t.help}</span>
            </span>
            <input
              type="checkbox"
              name={t.key}
              defaultChecked={prefs[t.key]}
              className="mt-1 h-4 w-4 flex-shrink-0"
            />
          </div>
        ))}
        <Button type="submit" disabled={savingPrefs} className="mt-4">
          {savingPrefs ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Save Preferences"}
        </Button>
      </form>
    </div>
  );
}
