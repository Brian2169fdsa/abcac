"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const labelCls = "mb-1.5 block text-sm font-semibold";

const CERT_STATUS = [
  { value: "applying", label: "Applying for initial certification" },
  { value: "active_holder", label: "Active ABCAC certification holder" },
  { value: "reciprocity_transfer", label: "Transferring via IC&RC reciprocity" },
];

// Cert holders self-report the credential number(s) they already hold so an
// admin can verify before approving. Members can't write the certifications
// table (RLS, migration 013), so the numbers ride along in signUp metadata.
const NEEDS_CERT_NUMBERS = new Set(["active_holder", "reciprocity_transfer"]);
type CertEntry = { number: string; type: string };

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [certStatus, setCertStatus] = useState("applying");
  const [certEntries, setCertEntries] = useState<CertEntry[]>([{ number: "", type: "" }]);

  const showCertNumbers = NEEDS_CERT_NUMBERS.has(certStatus);

  function updateEntry(i: number, patch: Partial<CertEntry>) {
    setCertEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function addEntry() { setCertEntries((prev) => [...prev, { number: "", type: "" }]); }
  function removeEntry(i: number) { setCertEntries((prev) => prev.filter((_, idx) => idx !== i)); }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const first = g("first").value.trim();
    const last = g("last").value.trim();
    const email = g("email").value.trim();
    const phone = g("phone").value.trim();
    const pw = g("pw").value;
    const pw2 = g("pw2").value;
    const terms = g("terms").checked;

    if (!first || !last || !email || !pw) return setError("Please complete all required fields.");
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    if (!terms) return setError("Please agree to the Code of Ethics and Terms of Use.");

    // Normalize self-reported certification number(s).
    const cleaned = certEntries
      .map((c) => ({ number: c.number.trim(), type: c.type.trim() }))
      .filter((c) => c.number);
    if (showCertNumbers && cleaned.length === 0) {
      return setError("Please enter at least one certification number.");
    }
    // Compact text the admin reads; e.g. "12345 (AAC), 67890". Empty otherwise.
    const certNumbersText = cleaned
      .map((c) => (c.type ? `${c.number} (${c.type})` : c.number))
      .join(", ");

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: {
            first_name: first,
            last_name: last,
            phone,
            cert_status: certStatus,
            ...(certNumbersText ? { cert_numbers: certNumbersText } : {}),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
        },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-20 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
        <h1 className="mt-6">Check your email</h1>
        <p className="mt-3 text-muted">We sent a confirmation link to verify your address. Click it to activate your account, then sign in.</p>
        <Link href="/login" className="mt-6 inline-block font-semibold text-brand hover:text-brand-600">Go to sign in →</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-16">
      <h1 className="text-center">Create your account</h1>
      <p className="mt-2 text-center text-muted">Join the {siteConfig.shortName} member portal.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl border border-line bg-surface p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>First name *</span><input name="first" className={field} required /></label>
          <label className="block"><span className={labelCls}>Last name *</span><input name="last" className={field} required /></label>
        </div>
        <label className="block"><span className={labelCls}>Email *</span><input name="email" type="email" className={field} required autoComplete="email" /></label>
        <label className="block"><span className={labelCls}>Phone</span><input name="phone" type="tel" className={field} placeholder="(480) 555-0123" /></label>
        <label className="block"><span className={labelCls}>I am…</span>
          <select
            name="cert_status"
            className={field}
            value={certStatus}
            onChange={(e) => setCertStatus(e.target.value)}
          >
            {CERT_STATUS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        {showCertNumbers && (
          <div className="rounded-lg border border-line bg-bg/40 p-4">
            <span className={labelCls}>Certification number(s) *</span>
            <p className="mb-3 text-xs text-muted">Enter the ABCAC/IC&amp;RC certification number(s) you currently hold so we can verify them. Add a credential type if you have more than one.</p>
            <div className="space-y-2">
              {certEntries.map((entry, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1.5fr_auto]">
                  <input
                    className={field}
                    placeholder="Certification number"
                    value={entry.number}
                    onChange={(e) => updateEntry(i, { number: e.target.value })}
                    aria-label={`Certification number ${i + 1}`}
                  />
                  <input
                    className={field}
                    placeholder="Credential type (optional)"
                    value={entry.type}
                    onChange={(e) => updateEntry(i, { type: e.target.value })}
                    aria-label={`Credential type ${i + 1}`}
                  />
                  {certEntries.length > 1 && (
                    <Button type="button" variant="outline" size="sm" onClick={() => removeEntry(i)} aria-label={`Remove certification ${i + 1}`}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addEntry}>
              + Add another number
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>Password *</span><input name="pw" type="password" className={field} required autoComplete="new-password" placeholder="Min. 8 characters" /></label>
          <label className="block"><span className={labelCls}>Confirm *</span><input name="pw2" type="password" className={field} required autoComplete="new-password" /></label>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input name="terms" type="checkbox" className="mt-1 h-4 w-4" />
          <span>
            I agree to the ABCAC <Link href="/code-of-ethics" target="_blank" className="font-semibold text-brand hover:underline">Code of Ethics</Link>,{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-brand hover:underline">Terms of Use</Link>, and{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-brand hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Create Account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand">Sign in</Link>
      </p>
    </div>
  );
}
