"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

function ForgotInner() {
  const params = useSearchParams();
  // /auth/callback sends members here when a reset link could not be used —
  // most often because it expired or was opened on a different device than the
  // one that requested it (the one-time code is bound to that browser).
  const linkExpired = params.get("error") === "reset_link_invalid";
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value.trim();
    if (!email) return setError("Please enter your email.");
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-20">
      <h1 className="text-center">Reset your password</h1>
      {linkExpired && !sent && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          That reset link is no longer valid. Links expire after a short time and must be opened on the same
          device and browser where you requested them. Enter your email below and we&apos;ll send a fresh one — then
          open it here.
        </div>
      )}
      {sent ? (
        <p className="mt-4 text-center text-muted">If an account exists for that email, we&apos;ve sent a password reset link. Check your inbox.</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl border border-line bg-surface p-7">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Email</span><input name="email" type="email" className={field} required autoComplete="email" /></label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Send Reset Link"}
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand">Back to sign in</Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  // useSearchParams requires a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={<div className="px-5 py-20 text-center text-muted">Loading…</div>}>
      <ForgotInner />
    </Suspense>
  );
}
