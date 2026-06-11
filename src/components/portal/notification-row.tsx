"use client";

// A single notification on the /account/notifications list. Mirrors the bell's
// openItem UX: clicking marks the row read (if unread) then navigates to its
// link (falling back to /account). Pure presentation bits (icon, tone, label,
// timeAgo) come from props so the parent server component stays simple.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { categoryMeta, type Notification } from "@/lib/notifications";
import { iconFor, timeAgo } from "@/app/(portal)/account/notifications/helpers";
import { markReadAction } from "@/app/(portal)/account/notifications/actions";

export function NotificationRow({ n }: { n: Notification }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const meta = categoryMeta(n.category);
  const Icon = iconFor(meta.icon);
  const unread = !n.read_at;

  const open = () => {
    startTransition(async () => {
      if (unread) await markReadAction([n.id]);
      router.push(n.link ?? "/account");
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-busy={pending}
      className={`flex w-full items-start gap-4 rounded-xl border border-line bg-surface px-4 py-4 text-left shadow-sm transition-colors hover:bg-bg/50 ${
        unread ? "border-l-4 border-l-brand" : ""
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}
          >
            {meta.label}
          </span>
          <span className="text-[11px] text-muted">{timeAgo(n.created_at)}</span>
        </span>
        <span className={`mt-1 block text-sm ${unread ? "font-bold text-ink" : "font-semibold text-ink"}`}>
          {n.title}
        </span>
        {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
      </span>

      {unread && (
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />
      )}
    </button>
  );
}
