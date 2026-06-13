import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { AdminAgentWorkspace } from "@/components/agent/admin-agent-workspace";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAdminAnalytics } from "@/lib/admin-analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Agent — ABCAC Admin Console",
};

export default async function AdminAgentPage() {
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
