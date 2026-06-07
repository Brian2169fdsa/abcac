"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Clock, XCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const labelCls = "mb-1.5 block text-sm font-semibold";
const CREDENTIALS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"];

export interface OnboardingProfile {
  first_name: string | null; last_name: string | null; phone: string | null; date_of_birth: string | null;
  address_line1: string | null; city: string | null; state: string | null; zip_code: string | null;
  account_status: string | null; account_submitted_at: string | null; account_review_notes: string | null;
}

interface CertRow { cert_type: string; cert_number: string; }

export function OnboardingFlow({ profile }: { profile: OnboardingProfile }) {
  const router = useRouter();
  const submittedPending = profile.account_status === "pending" && profile.account_submitted_at;
  const rejected = profile.account_status === "rejected";

  const [certs, setCerts] = useState<CertRow[]>([{ cert_type: "", cert_number: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Awaiting review — show status instead of the form.
  if (submittedPending && !rejected) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-8 text-center">
        <Clock className="mx-auto h-12 w-12 text-amber-600" aria-hidden />
        <h2 className="mt-4 text-xl">Your account is under review</h2>
        <p className="mt-2 text-muted">
          Thanks for registering. ABCAC staff are reviewing your information and certifications. You&apos;ll receive an
          email once your account is approved.
        </p>
      </div>
    );
  }

  function update(i: number, key: keyof CertRow, value: string) {
    setCerts((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }
  function addRow() { setCerts((r) => [...r, { cert_type: "", cert_number: "" }]); }
  function removeRow(i: number) { setCerts((r) => r.filter((_, idx) => idx !== i)); }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value.trim();
    if (!g("first") || !g("last")) return setError("Please provide your first and last name.");

    const validCerts = certs.filter((c) => c.cert_type);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Session expired — please sign in again."); setLoading(false); return; }

      // Save profile details + mark submitted for review.
      const { error: pErr } = await supabase.from("profiles").update({
        first_name: g("first"), last_name: g("last"), phone: g("phone") || null,
        date_of_birth: g("dob") || null, address_line1: g("address") || null,
        city: g("city") || null, state: g("state") || null, zip_code: g("zip") || null,
        account_status: "pending",
        account_submitted_at: new Date().toISOString(),
        account_review_notes: null,
      }).eq("id", user.id);
      if (pErr) throw pErr;

      // Replace any prior self-reported (pending) certs, then insert the current list.
      await supabase.from("certifications").delete().eq("member_id", user.id).eq("status", "pending");
      if (validCerts.length) {
        const rows = validCerts.map((c) => ({
          member_id: user.id, cert_type: c.cert_type, cert_number: c.cert_number || null, status: "pending",
        }));
        const { error: cErr } = await supabase.from("certifications").insert(rows);
        if (cErr) throw cErr;
      }

      router.refresh();
      // Re-enable the form in case the refreshed view still renders it
      // (e.g. the status did not advance), so it never gets stuck spinning.
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {rejected && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-5">
          <div className="flex items-center gap-2 font-semibold text-red-600"><XCircle className="h-5 w-5" aria-hidden /> Your account needs changes</div>
          {profile.account_review_notes && <p className="mt-2 text-sm text-muted">{profile.account_review_notes}</p>}
          <p className="mt-2 text-sm text-muted">Please update your information below and resubmit.</p>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-6">
        <h3 className="mb-4">Your information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>First name *</span><input name="first" className={field} defaultValue={profile.first_name ?? ""} required /></label>
          <label className="block"><span className={labelCls}>Last name *</span><input name="last" className={field} defaultValue={profile.last_name ?? ""} required /></label>
          <label className="block"><span className={labelCls}>Phone</span><input name="phone" className={field} defaultValue={profile.phone ?? ""} /></label>
          <label className="block"><span className={labelCls}>Date of birth</span><input name="dob" type="date" className={field} defaultValue={profile.date_of_birth ?? ""} /></label>
          <label className="block sm:col-span-2"><span className={labelCls}>Address</span><input name="address" className={field} defaultValue={profile.address_line1 ?? ""} /></label>
          <label className="block"><span className={labelCls}>City</span><input name="city" className={field} defaultValue={profile.city ?? ""} /></label>
          <label className="block"><span className={labelCls}>State</span><input name="state" className={field} defaultValue={profile.state ?? "Arizona"} /></label>
          <label className="block"><span className={labelCls}>ZIP</span><input name="zip" className={field} defaultValue={profile.zip_code ?? ""} /></label>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-6">
        <h3 className="mb-1">Your certifications</h3>
        <p className="mb-4 text-sm text-muted">List the ABCAC credentials you currently hold, including certificate numbers. Add a row for each.</p>
        <div className="space-y-3">
          {certs.map((c, i) => (
            <div key={i} className="flex gap-3">
              <select value={c.cert_type} onChange={(e) => update(i, "cert_type", e.target.value)} className={field} aria-label={`Credential ${i + 1}`}>
                <option value="">— Credential —</option>
                {CREDENTIALS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <input value={c.cert_number} onChange={(e) => update(i, "cert_number", e.target.value)} className={field} placeholder="Certificate number" aria-label={`Certificate number ${i + 1}`} />
              {certs.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-line text-muted hover:text-red-600" aria-label="Remove">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
          <Plus className="h-4 w-4" aria-hidden /> Add another certification
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Submit for Approval"}
      </Button>
      <p className="text-center text-xs text-muted">Your account will be reviewed by ABCAC staff before activation.</p>
    </form>
  );
}
