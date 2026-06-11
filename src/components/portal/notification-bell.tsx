"use client";

// Notification bell for the portal top bar: a count badge + a dropdown of the
// most recent notifications, with "mark all read" and per-item navigation that
// marks the item read on the way. Initial data is server-rendered (passed as
// props from the portal layout); actions revalidate the layout to refresh.

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { categoryMeta, type Notification } from "@/lib/notifications";
import { markReadAction, markAllReadAction } from "@/app/(portal)/account/notifications/actions";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
}

export function NotificationBell({
  count,
  items,
}: {
  count: number;
  items: Notification[];
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markAll = () => startTransition(async () => { await markAllReadAction(); router.refresh(); });
  const openItem = (n: Notification) => {
    setOpen(false);
    startTransition(async () => {
      if (!n.read_at) await markReadAction([n.id]);
      router.push(n.link ?? "/account/notifications");
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Notifications</span>
        {count > 0 && <Badge className="bg-red-600">{count > 99 ? "99+" : count}</Badge>}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {count > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-semibold text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted">You&apos;re all caught up.</div>
            ) : (
              items.map((n) => {
                const meta = categoryMeta(n.category);
                return (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-bg/50 ${
                      n.read_at ? "" : "bg-brand/[0.04]"
                    }`}
                  >
                    <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
                      {meta.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{n.title}</span>
                      {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />}
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/account/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-sm font-semibold text-brand hover:bg-bg/50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
