// ABCAC — admin-driven notification broadcast (fan-out producer).
//
// The member Notifications stream (migration 034) is normally fed by AFTER
// INSERT triggers on member-facing tables. This module adds the ONE producer
// those triggers can't cover: an admin deliberately broadcasting an
// announcement to the whole membership. Given an already-authorized service
// (RLS-bypassing) client, it resolves every eligible recipient and bulk-inserts
// one `notifications` row per member (category 'announcement' by default).
//
// Recipient resolution is "default opt-IN": every approved member receives the
// announcement EXCEPT those who explicitly set notification_preferences
// .abcac_announcements = false. Members with no preferences row are included.
//
// The function takes the admin client as its first argument so it is pure and
// unit-testable; the caller is responsible for verifying admin authorization
// and supplying the service-role client. Failures are reported, never thrown.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationCategory } from "@/lib/notifications";

/** Supabase caps a single insert; chunk anything larger to stay well under it. */
const INSERT_CHUNK = 1000;

export interface BroadcastInput {
  title: string;
  body?: string | null;
  link?: string | null;
  /** Defaults to 'announcement' — the admin-broadcast category. */
  category?: NotificationCategory;
}

export interface BroadcastOptions {
  /**
   * Restrict to a member account_status set. Defaults to ['approved'] — only
   * active members. Pass null to include EVERY member regardless of status.
   */
  accountStatuses?: string[] | null;
}

export interface BroadcastResult {
  ok: boolean;
  recipientCount: number;
  error?: string;
}

type NotificationRow = {
  member_id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  link: string | null;
};

/**
 * Fan an admin announcement out to every eligible member as an in-app
 * notification. Best-effort by contract: any DB error is returned as
 * `{ ok: false }` rather than thrown, so a calling create-flow can swallow it.
 *
 * @param admin a service-role Supabase client (RLS-bypassing). The CALLER must
 *              have already verified the actor is an admin.
 */
export async function broadcastToMembers(
  admin: SupabaseClient,
  input: BroadcastInput,
  opts: BroadcastOptions = {},
): Promise<BroadcastResult> {
  const title = (input.title ?? "").trim();
  if (!title) return { ok: false, recipientCount: 0, error: "missing_title" };

  const category: NotificationCategory = input.category ?? "announcement";
  const body = input.body?.trim() ? input.body.trim() : null;
  const link = input.link?.trim() ? input.link.trim() : null;

  // account_status filter: default to approved/active members.
  const statuses =
    opts.accountStatuses === null
      ? null
      : opts.accountStatuses ?? ["approved"];

  try {
    // 1. All candidate member ids.
    let memberQuery = admin.from("profiles").select("id");
    if (statuses && statuses.length > 0) {
      memberQuery = memberQuery.in("account_status", statuses);
    }
    const { data: memberRows, error: membersErr } = await memberQuery;
    if (membersErr) {
      return { ok: false, recipientCount: 0, error: membersErr.message };
    }
    const memberIds = (memberRows ?? [])
      .map((r) => (r as { id?: string }).id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (memberIds.length === 0) return { ok: true, recipientCount: 0 };

    // 2. Members who explicitly opted OUT of announcements.
    const { data: optedOutRows, error: prefsErr } = await admin
      .from("notification_preferences")
      .select("member_id")
      .eq("abcac_announcements", false);
    if (prefsErr) {
      return { ok: false, recipientCount: 0, error: prefsErr.message };
    }
    const optedOut = new Set(
      (optedOutRows ?? [])
        .map((r) => (r as { member_id?: string }).member_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );

    // 3. Recipients = members minus opted-out (no prefs row ⇒ default opt-IN).
    const recipientIds = memberIds.filter((id) => !optedOut.has(id));
    if (recipientIds.length === 0) return { ok: true, recipientCount: 0 };

    // 4. Build one row per recipient and bulk-insert (chunked).
    const rows: NotificationRow[] = recipientIds.map((member_id) => ({
      member_id,
      category,
      title,
      body,
      link,
    }));

    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const chunk = rows.slice(i, i + INSERT_CHUNK);
      const { error: insertErr } = await admin.from("notifications").insert(chunk);
      if (insertErr) {
        return { ok: false, recipientCount: 0, error: insertErr.message };
      }
    }

    return { ok: true, recipientCount: recipientIds.length };
  } catch (e) {
    // Best-effort: never throw out of a broadcast.
    return {
      ok: false,
      recipientCount: 0,
      error: e instanceof Error ? e.message : "broadcast_failed",
    };
  }
}
