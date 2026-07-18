import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { AdminAgentWorkspace } from "@/components/agent/admin-agent-workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminAnalytics } from "@/lib/admin-analytics";
import { agentWorkspaceEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Agent — ABCAC Admin Console",
};

export default async function AdminAgentPage() {
  if (!agentWorkspaceEnabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">AI Agent</h1>
            <p className="mt-0.5 text-[14px] text-muted">Production data connection in progress.</p>
          </div>
        </div>
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-8">
          <span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand">
            Coming soon
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">A trustworthy workspace, not a mock preview</h2>
          <p className="mt-2 max-w-2xl leading-7 text-muted">
            The AI workspace remains private until member lookups, task actions, and analytics are fully connected to live ABCAC records and pass launch review.
          </p>
        </section>
      </div>
    );
  }

  // Real analytics for the KPI strip, Trends panel, and data artifacts. The
  // (admin) layout already enforces the admin role for this route; reads are
  // aggregate + read-only, so the service-role client is used server-side only
  // (never exposed to the browser) — the same data the assistant's admin tools
  // read, so the chat and the charts always agree.
  const admin = createSupabaseAdminClient();
  const analytics = await getAdminAnalytics(admin);

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">AI Agent</h1>
          <p className="mt-0.5 text-[14px] text-muted">
            Your work partner — analytics, tasks, and actions in one place.
          </p>
        </div>
      </div>

      {/* Workspace */}
      <AdminAgentWorkspace analytics={analytics} />
    </div>
  );
}
