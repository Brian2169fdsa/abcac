"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  setMemberNotificationPrefs,
  type NotificationPrefsInput,
} from "@/app/(admin)/admin/members/[id]/notify-actions";

// Admin read+override view of a member's notification_preferences. The card
// shows what the member currently has toggled (so staff can SEE what was opted
// out of) and lets an admin override it. The underlying server action re-checks
// admin server-side; the local state here is only a UI convenience.

type PrefKey = keyof NotificationPrefsInput;

/** Nullable prefs as stored: a missing row (null) falls back to schema defaults. */
export type MemberNotifyPrefsValue = {
  renewal_reminders?: boolean | null;
  ceu_deadline_alerts?: boolean | null;
  abcac_announcements?: boolean | null;
  icrc_updates?: boolean | null;
} | null;

// Schema defaults (migration 001): all TRUE except icrc_updates FALSE.
const DEFAULTS: NotificationPrefsInput = {
  renewal_reminders: true,
  ceu_deadline_alerts: true,
  abcac_announcements: true,
  icrc_updates: false,
};

const TOGGLES: { key: PrefKey; label: string; help: string; badge?: string }[] = [
  {
    key: "renewal_reminders",
    label: "Renewal reminders",
    help: "Scheduled emails at 90, 60 and 30 days before certification expiry.",
    badge: "gates reminders",
  },
  {
    key: "ceu_deadline_alerts",
    label: "CEU deadline alerts",
    help: "Scheduled emails when the member is behind on CEU hours near renewal.",
    badge: "gates reminders",
  },
  {
    key: "abcac_announcements",
    label: "ABCAC announcements",
    help: "General staff broadcasts delivered to the member's inbox and email.",
    badge: "gates broadcasts",
  },
  {
    key: "icrc_updates",
    label: "IC&RC updates",
    help: "Broadcasts about IC&RC reciprocity and credentialing.",
    badge: "gates broadcasts",
  },
];

function resolve(prefs: MemberNotifyPrefsValue): NotificationPrefsInput {
  if (!prefs) return { ...DEFAULTS };
  return {
    renewal_reminders: prefs.renewal_reminders ?? DEFAULTS.renewal_reminders,
    ceu_deadline_alerts: prefs.ceu_deadline_alerts ?? DEFAULTS.ceu_deadline_alerts,
    abcac_announcements: prefs.abcac_announcements ?? DEFAULTS.abcac_announcements,
    icrc_updates: prefs.icrc_updates ?? DEFAULTS.icrc_updates,
  };
}

type Feedback = { ok: boolean; text: string } | null;

/**
 * Card that surfaces and overrides a member's notification toggles. When `prefs`
 * is null the member has no row yet and schema defaults (true/true/true/false)
 * are shown. Saving UPSERTs an override via `setMemberNotificationPrefs`.
 */
export function MemberNotifyPrefs({
  memberId,
  prefs,
}: {
  memberId: string;
  prefs: MemberNotifyPrefsValue;
}) {
  const [values, setValues] = useState<NotificationPrefsInput>(() => resolve(prefs));
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const noRow = prefs == null;

  function toggle(key: PrefKey) {
    setFeedback(null);
    setValues((v) => ({ ...v, [key]: !v[key] }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await setMemberNotificationPrefs(memberId, values);
      if (res.ok) {
        setFeedback({ ok: true, text: "Notification preferences saved." });
      } else {
        const text =
          res.error === "forbidden"
            ? "Only an admin can override notification preferences."
            : res.error === "unauthorized"
              ? "Session expired — please sign in again."
              : "Failed: " + res.error;
        setFeedback({ ok: false, text });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Notification preferences</span>
        {noRow && (
          <span className="rounded-full bg-line/60 px-2 py-0.5 text-[11px] font-semibold text-muted">
            defaults
          </span>
        )}
      </div>
      <p className="text-xs text-muted">
        These are the member&rsquo;s own opt-in toggles. The{" "}
        <span className="font-semibold">Renewal reminders</span> and{" "}
        <span className="font-semibold">CEU deadline alerts</span> toggles gate the automated
        reminders engine — turning one off stops the matching scheduled email. Overriding here
        saves on the member&rsquo;s behalf.
      </p>

      <div>
        {TOGGLES.map((t) => (
          <label
            key={t.key}
            className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0"
          >
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">
                {t.label}
                {t.badge && (
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                    {t.badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t.help}</span>
            </span>
            <input
              type="checkbox"
              name={t.key}
              checked={values[t.key]}
              onChange={() => toggle(t.key)}
              disabled={pending}
              className="mt-1 h-4 w-4 flex-shrink-0 rounded border-line"
            />
          </label>
        ))}
      </div>

      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
