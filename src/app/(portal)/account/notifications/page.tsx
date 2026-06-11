import Link from "next/link";
import { Bell } from "lucide-react";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchNotifications, fetchUnreadCount } from "@/lib/notifications";
import { NotificationRow } from "@/components/portal/notification-row";
import { MarkAllReadButton } from "@/components/portal/mark-all-read-button";
import {
  parseParams,
  filterByCategory,
  categoryOptions,
  buildHref,
} from "./helpers";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { filter?: string; category?: string };
}) {
  const { filter, category } = parseParams(searchParams ?? {});

  const supabase = createSupabaseServerClient();
  const [rows, unreadCount] = await Promise.all([
    fetchNotifications(supabase, { limit: 100, unreadOnly: filter === "unread" }),
    fetchUnreadCount(supabase),
  ]);

  // Category filtering on the already-fetched rows: cheaper than a refetch and
  // keeps the unread/all distinction (which drives the DB query) the only
  // server round-trip dimension.
  const visible = filterByCategory(rows, category);

  const filterTabs: { value: "all" | "unread"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
  ];

  const tabClass = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "bg-brand text-white"
        : "border border-line bg-surface text-muted hover:text-ink hover:bg-bg/50"
    }`;

  // Distinct empty-state copy for the three "nothing to show" situations.
  let emptyCopy: string | null = null;
  if (visible.length === 0) {
    if (rows.length === 0 && filter === "unread") {
      emptyCopy = "You're all caught up — no unread notifications.";
    } else if (rows.length === 0) {
      emptyCopy = "No notifications yet. Updates about your billing, documents, and certification will appear here.";
    } else {
      emptyCopy = "Nothing in this category right now.";
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Member Portal"
        title="Notifications"
        intro="Everything happening on your account — billing, documents, messages, and certification updates — in one place."
      />
      <Section compact>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">
            {unreadCount > 0 ? (
              <>
                <span className="font-semibold text-ink">{unreadCount}</span> unread
                notification{unreadCount !== 1 ? "s" : ""}
              </>
            ) : (
              "No unread notifications."
            )}
          </p>
          {unreadCount > 0 && <MarkAllReadButton />}
        </div>

        {/* Filter controls */}
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {filterTabs.map((t) => (
              <Link
                key={t.value}
                href={buildHref({ filter, category }, { filter: t.value })}
                className={tabClass(filter === t.value)}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {categoryOptions().map((opt) => (
              <Link
                key={opt.value}
                href={buildHref({ filter, category }, { category: opt.value })}
                className={tabClass(category === opt.value)}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {/* List / empty state */}
        {emptyCopy ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-bg px-5 py-16 text-center">
            <Bell className="mb-3 h-8 w-8 text-muted" aria-hidden />
            <p className="max-w-sm text-sm text-muted">{emptyCopy}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
