"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateDirectoryListing } from "@/app/(portal)/account/settings/actions";

/**
 * Member privacy control for the public ABCAC directory. The stored column is
 * `directory_opt_out`; here we present the positive framing "List my credential
 * publicly" (= !directory_opt_out) so the choice is unambiguous. Saving calls
 * the auth-bound `updateDirectoryListing` server action.
 */
export function DirectoryListingSettings({ optOut }: { optOut: boolean }) {
  // UI tracks the positive choice; persist the negation.
  const [listed, setListed] = useState(!optOut);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save(nextListed: boolean) {
    setErr(null);
    setMsg(null);
    setListed(nextListed);
    startTransition(async () => {
      const res = await updateDirectoryListing(!nextListed);
      if (!res.ok) {
        // Roll back the optimistic toggle on failure.
        setListed(!nextListed);
        setErr("Could not save your directory preference. Please try again.");
        return;
      }
      setMsg(
        nextListed
          ? "Your credential will be listed in the public directory."
          : "You have opted out of the public directory.",
      );
      setTimeout(() => setMsg(null), 3500);
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h3 className="mb-1">Public directory listing</h3>
      <p className="mb-4 text-sm text-muted">
        Your active certification can be confirmed by employers in the public ABCAC directory. You can
        opt out of public listing. When you opt out, employers can&apos;t self-verify your credential and
        must contact ABCAC directly.
      </p>

      {msg && (
        <div className="mb-4 rounded-lg border border-success/40 bg-success/5 px-4 py-2 text-sm text-success">
          {msg}
        </div>
      )}
      {err && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 border-t border-line py-4">
        <span className="flex-1">
          <span className="block text-sm font-semibold">List my credential publicly</span>
          <span className="mt-0.5 block text-xs text-muted">
            {listed
              ? "Listed — employers can confirm your active credential at /verify and in /directory."
              : "Opted out — your credential is hidden from the public directory and self-verification."}
          </span>
        </span>
        <input
          type="checkbox"
          name="directory_listed"
          checked={listed}
          disabled={isPending}
          onChange={(e) => save(e.currentTarget.checked)}
          className="mt-1 h-4 w-4 flex-shrink-0"
          aria-label="List my credential publicly"
        />
      </div>

      {isPending && (
        <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
        </div>
      )}
    </div>
  );
}
