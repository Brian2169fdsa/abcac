"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminNav, type AdminCounts } from "@/components/admin/admin-nav";

/**
 * Maroon left sidebar shell for the admin console. Holds the brand mark, the
 * navigation (with per-queue count badges), the admin identity + sign out, and
 * a mobile menu toggle that collapses the sidebar off-canvas.
 */
export function AdminSidebar({ name, counts, children }: { name: string; counts: AdminCounts; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg">
      {/* Mobile backdrop */}
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-brand text-white transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
      >
        <Link href="/admin" className="flex flex-col gap-0.5 border-b border-white/10 px-5 py-5 leading-none" onClick={() => setOpen(false)}>
          <span className="font-display text-lg font-bold text-white">ABCAC</span>
          <span className="text-[10px] uppercase tracking-wider text-accent">Admin Console</span>
        </Link>

        <div className="flex-1 overflow-y-auto py-3">
          <AdminNav counts={counts} onNavigate={() => setOpen(false)} />
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="truncate text-sm text-white/80">{name}</div>
          <div className="text-[11px] uppercase tracking-wider text-accent">Admin</div>
          <div className="mt-2 flex flex-col gap-1">
            <Link href="/" className="text-sm font-semibold text-white/80 hover:text-white">
              ← Back to Site
            </Link>
            <Link href="/logout" className="text-sm font-semibold text-accent hover:text-accent/80">
              Sign out
            </Link>
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-5 py-3 md:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-lg p-1 text-brand md:hidden"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="ml-auto text-sm text-muted">
            <span className="font-medium text-ink">{name}</span> · Admin
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-content px-5 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
