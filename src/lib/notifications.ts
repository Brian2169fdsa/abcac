// ABCAC — member notifications data layer.
//
// In-app "activity feed" for members: one stream of what happened (invoices,
// document requests, inbound messages, tasks) fanned out by DB triggers (see
// migration 034). These helpers read/update through the cookie-bound server
// client, so RLS scopes every query to the signed-in member automatically; the
// mark-read writes additionally pin member_id from the session as defense in
// depth. Functions take the client as an argument so they're unit-testable.

import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationCategory =
  | "billing"
  | "documents"
  | "application"
  | "certification"
  | "message"
  | "announcement"
  | "general";

export interface Notification {
  id: string;
  member_id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string | null;
}

export interface CategoryMeta {
  label: string;
  /** lucide-react icon name the UI maps to a component. */
  icon: string;
  /** Tailwind tone classes for the category chip/icon. */
  tone: string;
}

export const CATEGORY_META: Record<NotificationCategory, CategoryMeta> = {
  billing: { label: "Billing", icon: "Receipt", tone: "bg-[#3E8E41]/10 text-[#3E8E41]" },
  documents: { label: "Documents", icon: "FileText", tone: "bg-[#C8741F]/10 text-[#C8741F]" },
  application: { label: "Application", icon: "ClipboardList", tone: "bg-[#1F5FA8]/10 text-[#1F5FA8]" },
  certification: { label: "Certification", icon: "BadgeCheck", tone: "bg-brand/10 text-brand" },
  message: { label: "Message", icon: "Mail", tone: "bg-[#6D28D9]/10 text-[#6D28D9]" },
  announcement: { label: "Announcement", icon: "Megaphone", tone: "bg-accent/10 text-accent" },
  general: { label: "Update", icon: "Bell", tone: "bg-muted/15 text-muted" },
};

export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[(category as NotificationCategory)] ?? CATEGORY_META.general;
}

const SELECT = "id,member_id,category,title,body,link,read_at,created_at";

/** Recent notifications for the signed-in member (RLS-scoped), newest first. */
export async function fetchNotifications(
  sb: SupabaseClient,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<Notification[]> {
  let query = sb
    .from("notifications")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 30);
  if (opts.unreadOnly) query = query.is("read_at", null);
  const { data } = await query;
  return (data as Notification[] | null) ?? [];
}

/** Count of unread notifications for the signed-in member (RLS-scoped). */
export async function fetchUnreadCount(sb: SupabaseClient): Promise<number> {
  const { count } = await sb
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

/** Resolve the current member id from the session, or null. */
async function currentMemberId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb.auth.getUser();
  return data?.user?.id ?? null;
}

/** Mark specific notifications read (no-op for an empty id list). */
export async function markNotificationsRead(
  sb: SupabaseClient,
  ids: string[],
): Promise<{ ok: boolean; error?: string }> {
  const clean = ids.filter((id) => typeof id === "string" && id.length > 0);
  if (clean.length === 0) return { ok: true };
  const memberId = await currentMemberId(sb);
  if (!memberId) return { ok: false, error: "not_authenticated" };
  const { error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", memberId) // belt-and-suspenders with RLS
    .is("read_at", null)
    .in("id", clean);
  return { ok: !error, error: error?.message };
}

/** Mark every unread notification for the member read. */
export async function markAllNotificationsRead(
  sb: SupabaseClient,
): Promise<{ ok: boolean; error?: string }> {
  const memberId = await currentMemberId(sb);
  if (!memberId) return { ok: false, error: "not_authenticated" };
  const { error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", memberId)
    .is("read_at", null);
  return { ok: !error, error: error?.message };
}
