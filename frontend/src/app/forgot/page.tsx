"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export default function ForgotPasswordPage() {
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
