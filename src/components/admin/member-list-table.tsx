import Link from "next/link";
import { cn } from "@/lib/utils";
import { RoleBadge } from "@/components/admin/role-badge";
import { MemberManage } from "@/components/admin/member-manage";
import type { PortalRole } from "@/lib/auth/roles";

export interface MemberRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  cert_status: string | null;
  account_status: string | null;
  portal_role: string | null;
}

// Account status chip — tokenized accents only, no hardcoded hex.
const STATUS_CLASS: Record<string, string> = {
  approved: "bg-brand/10 text-brand border border-brand/20",
  pending: "bg-accent/15 text-accent border border-accent/30",
  applying: "bg-accent/15 text-accent border border-accent/30",
  rejected: "bg-surface text-muted border border-line line-through",
};

function StatusChip({ status }: { status: string | null }) {
  const key = (status ?? "").toLowerCase();
  const label = status ? status.replace(/_/g, " ") : "—";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize leading-none",
        STATUS_CLASS[key] ?? "bg-surface text-muted border border-line",
      )}
    >
      {label}
    </span>
  );
}

function asRole(role: string | null): PortalRole {
  return role === "admin" || role === "superadmin" || role === "member"
    ? role
    : "member";
}

function displayName(m: MemberRow): string {
  return [m.first_name, m.last_name].filter(Boolean).join(" ") || "View member";
}

/**
 * Server-friendly member directory table. Each row links to the member detail
 * page and keeps the inline `MemberManage` control (account status + role)
 * working. Renders an empty state when there are no matching rows.
 */
export function MemberListTable({ members }: { members: MemberRow[] }) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface px-5 py-12 text-center">
        <p className="text-sm font-medium">No members match your filters.</p>
        <p className="mt-1 text-sm text-muted">
          Try a different search term or clear the filters above.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3">Name</th>
            <th className="px-5 py-3">Email</th>
            <th className="px-5 py-3">Cert status</th>
            <th className="px-5 py-3">Account</th>
            <th className="px-5 py-3">Role</th>
            <th className="px-5 py-3">Manage</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b border-line last:border-0">
              <td className="px-5 py-3 font-semibold">
                <Link
                  href={`/admin/members/${m.id}`}
                  className="text-brand hover:text-brand-600 hover:underline"
                >
                  {displayName(m)}
                </Link>
              </td>
              <td className="px-5 py-3 text-muted">{m.email ?? "—"}</td>
              <td className="px-5 py-3 capitalize text-muted">
                {(m.cert_status ?? "—").replace(/_/g, " ")}
              </td>
              <td className="px-5 py-3">
                <StatusChip status={m.account_status} />
              </td>
              <td className="px-5 py-3">
                <RoleBadge role={asRole(m.portal_role)} />
              </td>
              <td className="px-5 py-3">
                <MemberManage
                  id={m.id}
                  accountStatus={m.account_status}
                  role={m.portal_role}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
