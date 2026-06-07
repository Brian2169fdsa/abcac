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

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = e.currentTarget;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement);
    const first = g("first").value.trim();
    const last = g("last").value.trim();
    const email = g("email").value.trim();
    const phone = g("phone").value.trim();
    const certStatus = (f.elements.namedItem("cert_status") as HTMLSelectElement).value;
    const pw = g("pw").value;
    const pw2 = g("pw2").value;
    const terms = g("terms").checked;

    if (!first || !last || !email || !pw) return setError("Please complete all required fields.");
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    if (!terms) return setError("Please agree to the Code of Ethics and Terms of Use.");

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: { first_name: first, last_name: last, phone, cert_status: certStatus },
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
          <select name="cert_status" className={field} defaultValue="applying">
            {CERT_STATUS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={labelCls}>Password *</span><input name="pw" type="password" className={field} required autoComplete="new-password" placeholder="Min. 8 characters" /></label>
          <label className="block"><span className={labelCls}>Confirm *</span><input name="pw2" type="password" className={field} required autoComplete="new-password" /></label>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted">
          <input name="terms" type="checkbox" className="mt-1 h-4 w-4" /> I agree to the ABCAC Code of Ethics and Terms of Use.
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
