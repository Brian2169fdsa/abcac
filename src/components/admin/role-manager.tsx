"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/admin/role-badge";
import { roleLabel, type PortalRole } from "@/lib/auth/roles";
import { changeMemberRole } from "@/app/(admin)/admin/members/[id]/cockpit-actions";

const field =
  "h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const ROLES: PortalRole[] = ["member", "admin", "superadmin"];

type Feedback = { ok: boolean; text: string } | null;

/**
 * Superadmin-only control to change a member's portal_role. Rendered by the page
 * ONLY when the viewer is a superadmin; the underlying server action re-checks
 * superadmin server-side regardless. Shows the current role with RoleBadge.
 */
export function RoleManager({
  memberId,
  currentRole,
}: {
  memberId: string;
  currentRole: PortalRole;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<PortalRole>(currentRole);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFeedback(null);
    if (selected === currentRole) {
      setFeedback({ ok: false, text: "Choose a different role." });
      return;
    }
    startTransition(async () => {
      const res = await changeMemberRole(memberId, selected);
      if (res.ok) {
        setFeedback({ ok: true, text: `Role updated to ${roleLabel(selected)}.` });
      } else {
        const text =
          res.error === "cannot_change_self"
            ? "You cannot change your own role."
            : res.error === "forbidden"
              ? "Only a superadmin can change roles."
              : "Failed: " + res.error;
        setFeedback({ ok: false, text });
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Portal role</span>
        <RoleBadge role={currentRole} />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
          Change role
        </span>
        <select
          name="role"
          className={field}
          value={selected}
          onChange={(e) => setSelected(e.target.value as PortalRole)}
          disabled={pending}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </label>
      {feedback && (
        <p className={`text-sm ${feedback.ok ? "text-success" : "text-red-600"}`}>{feedback.text}</p>
      )}
      <Button type="submit" size="sm" disabled={pending || selected === currentRole}>
        {pending ? "Updating…" : "Update role"}
      </Button>
    </form>
  );
}
