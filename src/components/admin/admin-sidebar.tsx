"use client";

import { useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { AdminNav, type AdminCounts } from "@/components/admin/admin-nav";
import { BrandLogo } from "@/components/brand-logo";
import { Sparkles } from "lucide-react";
import { agentWorkspaceEnabled } from "@/lib/feature-flags";

/**
 * Light left sidebar for the admin console — matches the member-portal sidebar
 * (white surface, maroon brand, ink nav with a maroon active state) so moving
 * between the two never feels like a different product. Holds the brand mark,
 * the navigation (with per-queue count badges), the admin identity + the
 * member-view / site / sign-out links, and a mobile off-canvas toggle.
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
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface text-ink transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
      >
        <Link href="/admin" className="flex flex-col items-start gap-2 border-b border-line px-5 py-5" onClick={() => setOpen(false)}>
          <BrandLogo className="h-9" />
          <span className="inline-flex rounded-full border border-brand/20 bg-brand/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
            Admin Console
          </span>
        </Link>

        {agentWorkspaceEnabled && (
          <div className="border-b border-line px-4 py-3">
            <Link
              href="/admin/agent"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI Agent
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-3">
          <AdminNav counts={counts} onNavigate={() => setOpen(false)} />
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="truncate text-sm font-medium text-ink">{name}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted">Admin</div>
          <div className="mt-2 flex flex-col gap-1">
            <Link href="/account" className="text-sm font-semibold text-ink/80 hover:text-brand" onClick={() => setOpen(false)}>
              ⇄ Switch to Member View
            </Link>
            <Link href="/" className="text-sm font-semibold text-ink/80 hover:text-brand">
              ← Back to Site
            </Link>
            <SignOutButton className="text-left text-sm font-semibold text-brand hover:text-brand-600">
              Sign out
            </SignOutButton>
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line/80 bg-surface/95 px-5 py-3 backdrop-blur-xl md:px-8">
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
