"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const field = "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The /auth/callback route exchanges the recovery code into a session cookie
    // before redirecting here, so the user should be authenticated.
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setHasSession(Boolean(data.user));
      setReady(true);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const g = (n: string) => (e.currentTarget.elements.namedItem(n) as HTMLInputElement);
    const pw = g("pw").value;
    const pw2 = g("pw2").value;
    if (pw.length < 8) return setError("Password must be at least 8 characters.");
    if (pw !== pw2) return setError("Passwords do not match.");
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { setError(error.message); setLoading(false); return; }
      setDone(true);
      setTimeout(() => { router.push("/account"); router.refresh(); }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (!ready) return <div className="px-5 py-20 text-center text-muted">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-md px-5 py-20">
      <h1 className="text-center">Set a new password</h1>
      {done ? (
        <p className="mt-4 text-center text-success">Password updated. Redirecting to your account…</p>
      ) : hasSession ? (
        <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl border border-line bg-surface p-7">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">New password</span><input name="pw" type="password" className={field} required autoComplete="new-password" /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Confirm password</span><input name="pw2" type="password" className={field} required autoComplete="new-password" /></label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Update Password"}
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-center text-muted">
          This reset link is invalid or has expired. <Link href="/forgot" className="font-semibold text-brand">Request a new one</Link>.
        </p>
      )}
    </div>
  );
}
