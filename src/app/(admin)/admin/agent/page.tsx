import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import {
  AdminAgentWorkspace,
  type AgentMember,
  type AgentTask,
  type AgentTaskPriority,
} from "@/components/agent/admin-agent-workspace";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
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

  // Roster + staff work queue come from the cookie-bound client, so RLS applies
  // (the admin policies grant full reads for the roles this layout admits).
  const sb = createSupabaseServerClient();
  const [analytics, rosterRes, tasksRes] = await Promise.all([
    getAdminAnalytics(admin),
    sb
      .from("profiles")
      .select("id, first_name, last_name, email, account_status, cert_status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("member_tasks")
      .select("id, member_id, title, detail, priority, status, due_date, visible_to_member, created_at")
      .in("status", ["open", "in_progress"])
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const rosterRows = rosterRes.data ?? [];
  const taskRows = tasksRes.data ?? [];

  // Two cheap follow-up lookups: active-cert counts for the roster, and names
  // for task owners (who may not be among the 20 most recent members).
  const rosterIds = rosterRows.map((p: any) => p.id as string);
  const taskMemberIds = Array.from(new Set(taskRows.map((t: any) => t.member_id as string)));
  const [certsRes, ownersRes] = await Promise.all([
    sb.from("certifications").select("member_id").eq("status", "active").in("member_id", rosterIds),
    sb.from("profiles").select("id, first_name, last_name, email").in("id", taskMemberIds),
  ]);

  const activeCertCount = new Map<string, number>();
  for (const c of certsRes.data ?? []) {
    const id = (c as any).member_id as string;
    activeCertCount.set(id, (activeCertCount.get(id) ?? 0) + 1);
  }

  const displayName = (p: any) =>
    [p?.first_name, p?.last_name].filter(Boolean).join(" ") || (p?.email ?? "Unknown member");

  const ownerById = new Map((ownersRes.data ?? []).map((p: any) => [p.id as string, p]));

  const members: AgentMember[] = rosterRows.map((p: any) => ({
    id: p.id as string,
    name: displayName(p),
    email: p.email ?? null,
    accountStatus: p.account_status ?? null,
    certStatus: p.cert_status ?? null,
    activeCerts: activeCertCount.get(p.id as string) ?? 0,
    joined: p.created_at ?? null,
  }));

  const tasks: AgentTask[] = taskRows.map((t: any) => ({
    id: t.id as string,
    memberId: t.member_id as string,
    memberName: displayName(ownerById.get(t.member_id as string)),
    title: (t.title as string) || "Untitled task",
    detail: t.detail ?? null,
    priority: (t.priority === "high" || t.priority === "low" ? t.priority : "normal") as AgentTaskPriority,
    status: t.status === "in_progress" ? "in_progress" : "open",
    dueDate: t.due_date ?? null,
    visibleToMember: Boolean(t.visible_to_member),
    createdAt: t.created_at as string,
  }));

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
      <AdminAgentWorkspace analytics={analytics} members={members} tasks={tasks} />
    </div>
  );
}
