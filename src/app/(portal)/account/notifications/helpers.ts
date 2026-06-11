// Pure, unit-testable helpers for the member Notifications page: searchParams
// parsing/clamping, the category-filter predicate, relative-time formatting,
// and the lucide icon-name -> component map. Kept free of React/server imports
// so they can be tested in isolation (see tests/notifications-page.test.ts).

import {
  Receipt,
  FileText,
  ClipboardList,
  BadgeCheck,
  Mail,
  Megaphone,
  Bell,
  type LucideIcon,
} from "lucide-react";
import {
  CATEGORY_META,
  type Notification,
  type NotificationCategory,
} from "@/lib/notifications";

export type NotificationFilter = "all" | "unread";

/** The category param accepts "all" plus every real category. */
export type CategoryParam = "all" | NotificationCategory;

const FILTERS: readonly NotificationFilter[] = ["all", "unread"];

const CATEGORIES = Object.keys(CATEGORY_META) as NotificationCategory[];

/** lucide-react components keyed by the icon name in CATEGORY_META. */
export const ICON_MAP: Record<string, LucideIcon> = {
  Receipt,
  FileText,
  ClipboardList,
  BadgeCheck,
  Mail,
  Megaphone,
  Bell,
};

/** Resolve a category's lucide icon, defaulting to Bell for anything unknown. */
export function iconFor(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Bell;
}

/** Parse + clamp the page's searchParams into a validated filter/category. */
export function parseParams(searchParams: {
  filter?: string;
  category?: string;
}): { filter: NotificationFilter; category: CategoryParam } {
  const filter: NotificationFilter = FILTERS.includes(
    searchParams.filter as NotificationFilter,
  )
    ? (searchParams.filter as NotificationFilter)
    : "all";

  const category: CategoryParam =
    searchParams.category === "all" || searchParams.category === undefined
      ? "all"
      : CATEGORIES.includes(searchParams.category as NotificationCategory)
        ? (searchParams.category as NotificationCategory)
        : "all";

  return { filter, category };
}

/** Whether a notification belongs in the selected category view. */
export function matchesCategory(
  n: Pick<Notification, "category">,
  category: CategoryParam,
): boolean {
  return category === "all" || n.category === category;
}

/** Filter a list of notifications by the selected category. */
export function filterByCategory<T extends Pick<Notification, "category">>(
  rows: T[],
  category: CategoryParam,
): T[] {
  if (category === "all") return rows;
  return rows.filter((n) => matchesCategory(n, category));
}

/** All category options for the filter row: "all" plus each real category. */
export function categoryOptions(): { value: CategoryParam; label: string }[] {
  return [
    { value: "all", label: "All" },
    ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_META[c].label })),
  ];
}

/**
 * Build an /account/notifications href that sets one param while preserving the
 * other. Omits params at their default ("all") to keep URLs clean.
 */
export function buildHref(
  current: { filter: NotificationFilter; category: CategoryParam },
  patch: Partial<{ filter: NotificationFilter; category: CategoryParam }>,
): string {
  const next = { ...current, ...patch };
  const qs = new URLSearchParams();
  if (next.filter !== "all") qs.set("filter", next.filter);
  if (next.category !== "all") qs.set("category", next.category);
  const s = qs.toString();
  return s ? `/account/notifications?${s}` : "/account/notifications";
}

/** Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return "";
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
}
