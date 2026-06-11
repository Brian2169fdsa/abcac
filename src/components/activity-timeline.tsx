// ABCAC — shared activity timeline renderer.
//
// Server-renderable. Consumes the normalized events from src/lib/activity.ts and
// draws a vertical timeline. Used on both the member portal (their own journey,
// links on) and the admin member-detail page (staff view, links off).

import Link from "next/link";
import {
  ClipboardList,
  BadgeCheck,
  CreditCard,
  Receipt,
  GraduationCap,
  FileText,
  FileQuestion,
  Mail,
  UserPen,
  ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { activityMeta, type ActivityEvent } from "@/lib/activity";
import { formatDateTimeWithYear } from "@/lib/format";

const ICONS: Record<string, LucideIcon> = {
  ClipboardList,
  BadgeCheck,
  CreditCard,
  Receipt,
  GraduationCap,
  FileText,
  FileQuestion,
  Mail,
  UserPen,
  ArrowLeftRight,
};

function Node({ event, linkable }: { event: ActivityEvent; linkable: boolean }) {
  const meta = activityMeta(event.type);
  const Icon = ICONS[meta.icon] ?? Mail;
  const inner = (
    <div className="flex gap-3">
      <div className="relative flex flex-col items-center">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="mt-1 w-px flex-1 bg-line" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-ink">{event.title}</span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{meta.label}</span>
        </div>
        {event.detail && <p className="mt-0.5 text-sm text-muted">{event.detail}</p>}
        <p className="mt-0.5 text-xs text-muted">{formatDateTimeWithYear(event.timestamp)}</p>
      </div>
    </div>
  );

  if (linkable && event.link) {
    return (
      <Link href={event.link} className="block rounded-lg transition-colors hover:bg-bg/50">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ActivityTimeline({
  events,
  linkable = false,
  emptyText = "No activity yet.",
}: {
  events: ActivityEvent[];
  linkable?: boolean;
  emptyText?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-bg/40 px-4 py-10 text-center text-sm text-muted">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="[&>*:last-child_.bg-line]:hidden">
      {events.map((e) => (
        <Node key={e.id} event={e} linkable={linkable} />
      ))}
    </div>
  );
}
