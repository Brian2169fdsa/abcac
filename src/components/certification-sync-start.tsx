"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Laptop, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificationSyncStart({ label = "Start Your Sync Request" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button type="button" size="lg" onClick={() => setOpen(true)}>{label}</Button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true" aria-labelledby="sync-start-title">
          <button type="button" className="absolute inset-0 bg-info/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close certification sync options" />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-surface shadow-2xl">
            <div className="border-b border-line bg-gradient-to-r from-brand/[0.08] to-info/[0.06] p-6 sm:p-8">
              <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-bg hover:text-ink" aria-label="Close">
                <X className="h-5 w-5" aria-hidden />
              </button>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Choose your format</p>
              <h2 id="sync-start-title" className="mt-2 text-2xl sm:text-3xl">Start a Certification Sync request</h2>
              <p className="mt-3 max-w-xl text-muted">Create an account or sign in so your request can be saved, resumed, paid, and tracked securely.</p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              <Link href="/account/certification-sync?mode=digital" className="group rounded-2xl border border-brand/20 bg-brand/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white"><Laptop className="h-5 w-5" aria-hidden /></span>
                <h3 className="mt-4 text-lg">Fill it out digitally</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">Save your progress, return later, sign online, and continue to payment.</p>
                <span className="mt-4 inline-flex font-semibold text-brand">Continue online →</span>
              </Link>
              <div className="rounded-2xl border border-line bg-bg p-5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-info text-white"><FileText className="h-5 w-5" aria-hidden /></span>
                <h3 className="mt-4 text-lg">Use the paper form</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">Print the official form, complete it, then sign in to upload and pay.</p>
                <div className="mt-4 flex flex-col gap-2">
                  <a href="/forms/certification-synchronization-request.pdf" download className="inline-flex items-center gap-2 font-semibold text-brand hover:underline"><Download className="h-4 w-4" aria-hidden /> Download form</a>
                  <Link href="/account/certification-sync?mode=paper" className="font-semibold text-brand hover:underline">Upload completed form →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
