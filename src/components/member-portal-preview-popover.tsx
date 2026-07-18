"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, LockKeyhole, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MemberPortalPreviewPopoverProps {
  open: boolean;
  onClose: () => void;
}

export function MemberPortalPreviewPopover({ open, onClose }: MemberPortalPreviewPopoverProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function unlockPortal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/portal-preview-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "That access code is not valid."
            : response.status === 429
              ? "Too many attempts. Wait a minute and try again."
              : "We could not verify the code. Try again.",
        );
        return;
      }
      window.location.assign("/account");
    } catch {
      setError("We could not verify the code. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/45 px-4 pt-20 backdrop-blur-sm sm:justify-end sm:px-8 sm:pt-24">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close member portal preview" />
      <div role="dialog" aria-modal="true" aria-labelledby="portal-preview-title" className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-brand/15 bg-white shadow-2xl shadow-ink/25">
        <div className="bg-gradient-to-br from-info via-info to-brand-600 px-6 pb-7 pt-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Coming Soon
            </span>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <LockKeyhole className="h-6 w-6" aria-hidden />
          </div>
          <h2 id="portal-preview-title" className="mt-4 text-2xl text-white">Member Portal Preview</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            The new member experience is almost ready. Authorized reviewers can enter a private access code below.
          </p>
        </div>

        <form onSubmit={unlockPortal} className="p-6">
          <label htmlFor="portal-preview-code" className="text-sm font-semibold text-ink">Access code</label>
          <div className="relative mt-2">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={inputRef}
              id="portal-preview-code"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="Enter 6-digit code"
              className="h-12 w-full rounded-xl border border-line bg-bg pl-11 pr-4 text-base tracking-[0.18em] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              required
            />
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={loading || code.length !== 6}>
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LockKeyhole className="h-5 w-5" aria-hidden />}
            {loading ? "Checking access…" : "Unlock Preview"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted">Private preview access · ABCAC authorized reviewers only</p>
        </form>
      </div>
    </div>
  );
}
