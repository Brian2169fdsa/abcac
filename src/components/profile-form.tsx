"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export interface ProfileData {
  first_name: string | null; last_name: string | null; email: string | null; phone: string | null;
  address_line1: string | null; city: string | null; state: string | null; zip_code: string | null;
}
export interface Prefs {
  renewal_reminders: boolean; ceu_deadline_alerts: boolean; abcac_announcements: boolean; icrc_updates: boolean;
}

export function ProfileForm({ profile, prefs }: { profile: ProfileData; prefs: Prefs }) {
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 3500); }

  async function saveInfo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const get = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value.trim() || null;
    setSavingInfo(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("profiles").update({
        first_name: get("first_name"), last_name: get("last_name"), phone: get("phone"),
        address_line1: get("address_line1"), city: get("city"), state: get("state"), zip_code: get("zip_code"),
      }).eq("id", user.id);
      flash(error ? "Could not save your information." : "Personal information saved.");
    } finally { setSavingInfo(false); }
  }

  async function savePrefs(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const ck = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).checked;
    setSavingPrefs(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("notification_preferences").upsert({
        member_id: user.id,
        renewal_reminders: ck("renewal_reminders"), ceu_deadline_alerts: ck("ceu_deadline_alerts"),
        abcac_announcements: ck("abcac_announcements"), icrc_updates: ck("icrc_updates"),
      });
      flash(error ? "Could not save preferences." : "Notification preferences saved.");
    } finally { setSavingPrefs(false); }
  }

  async function savePw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const pw = (f.elements.namedItem("pw") as HTMLInputElement).value;
    const pw2 = (f.elements.namedItem("pw2") as HTMLInputElement).value;
    if (pw.length < 8) return flash("Password must be at least 8 characters.");
    if (pw !== pw2) return flash("Passwords do not match.");
    setSavingPw(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      flash(error ? "Could not update password." : "Password updated.");
      if (!error) f.reset();
    } finally { setSavingPw(false); }
  }

  const toggle = "flex items-center justify-between border-b border-line py-3 last:border-0";

  return (
    <div className="space-y-6">
      {msg && <div className="rounded-lg border border-success/40 bg-success/5 px-4 py-2 text-sm text-success">{msg}</div>}

      <form onSubmit={saveInfo} className="rounded-xl border border-line bg-surface p-6">
        <h3 className="mb-4">Personal Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">First name</span><input name="first_name" className={field} defaultValue={profile.first_name ?? ""} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Last name</span><input name="last_name" className={field} defaultValue={profile.last_name ?? ""} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Email (login)</span><input className={field} value={profile.email ?? ""} disabled /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Phone</span><input name="phone" className={field} defaultValue={profile.phone ?? ""} /></label>
          <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Address</span><input name="address_line1" className={field} defaultValue={profile.address_line1 ?? ""} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">City</span><input name="city" className={field} defaultValue={profile.city ?? ""} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">State</span><input name="state" className={field} defaultValue={profile.state ?? ""} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">ZIP</span><input name="zip_code" className={field} defaultValue={profile.zip_code ?? ""} /></label>
        </div>
        <Button type="submit" disabled={savingInfo} className="mt-4">{savingInfo ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Save Information"}</Button>
      </form>

      <form onSubmit={savePrefs} className="rounded-xl border border-line bg-surface p-6">
        <h3 className="mb-2">Notification Preferences</h3>
        <div className={toggle}><span className="text-sm">Renewal reminders</span><input type="checkbox" name="renewal_reminders" defaultChecked={prefs.renewal_reminders} className="h-4 w-4" /></div>
        <div className={toggle}><span className="text-sm">CEU deadline alerts</span><input type="checkbox" name="ceu_deadline_alerts" defaultChecked={prefs.ceu_deadline_alerts} className="h-4 w-4" /></div>
        <div className={toggle}><span className="text-sm">ABCAC announcements</span><input type="checkbox" name="abcac_announcements" defaultChecked={prefs.abcac_announcements} className="h-4 w-4" /></div>
        <div className={toggle}><span className="text-sm">IC&RC updates</span><input type="checkbox" name="icrc_updates" defaultChecked={prefs.icrc_updates} className="h-4 w-4" /></div>
        <Button type="submit" disabled={savingPrefs} className="mt-4">{savingPrefs ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Save Preferences"}</Button>
      </form>

      <form onSubmit={savePw} className="rounded-xl border border-line bg-surface p-6">
        <h3 className="mb-4">Change Password</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">New password</span><input name="pw" type="password" className={field} autoComplete="new-password" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Confirm password</span><input name="pw2" type="password" className={field} autoComplete="new-password" /></label>
        </div>
        <Button type="submit" disabled={savingPw} className="mt-4">{savingPw ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Update Password"}</Button>
      </form>
    </div>
  );
}
