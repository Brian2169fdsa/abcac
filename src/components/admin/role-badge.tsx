import { cn } from "@/lib/utils";
import { roleLabel, type PortalRole } from "@/lib/auth/roles";

const TIER_CLASS: Record<PortalRole, string> = {
  member: "bg-surface text-muted border border-line",
  admin: "bg-brand/10 text-brand border border-brand/20",
  superadmin: "bg-accent/15 text-accent border border-accent/30",
};

/**
 * Presentational chip showing a profile's access tier. Server-component
 * friendly — no hooks, no client state.
 */
export function RoleBadge({ role, className }: { role: PortalRole; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
        TIER_CLASS[role],
        className,
      )}
    >
      {roleLabel(role)}
    </span>
  );
}
