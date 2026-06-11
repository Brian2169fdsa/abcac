import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth/roles";
import { broadcastToMembers } from "@/lib/notifications-broadcast";

export const runtime = "nodejs";

type Audience = "abcac_announcements" | "icrc_updates";

const AUDIENCES: Record<Audience, { column: string; label: string }> = {
  abcac_announcements: { column: "abcac_announcements", label: "ABCAC announcements" },
  icrc_updates: { column: "icrc_updates", label: "IC&RC updates" },
};

export async function POST(req: Request) {
  // 1. Re-check the cookie session is an admin before doing anything privileged.
  const sb = createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isAdminRole(profile.portal_role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2. Parse + validate the payload.
  let body: { subject?: string; body?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim();
  const message = (body.body ?? "").trim();
  const audience = (body.audience ?? "") as Audience;

  if (!subject || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!(audience in AUDIENCES)) {
    return NextResponse.json({ error: "invalid_audience" }, { status: 400 });
  }
  const { column, label } = AUDIENCES[audience];

  // 3. Use the service role (RLS-bypassing) ONLY now that we've confirmed admin.
  const admin = createSupabaseAdminClient();

  // Fetch opted-in members: notification_preferences.<column> = true, joined to a profile.
  const { data: prefs, error: prefsErr } = await admin
    .from("notification_preferences")
    .select("member_id, profiles!inner(id, email, first_name, last_name)")
    .eq(column, true);

  if (prefsErr) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  type Recipient = { id: string; email: string | null; first_name: string | null; last_name: string | null };
  const recipients: Recipient[] = (prefs ?? [])
    .map((row: any) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return p ? { id: p.id as string, email: p.email ?? null, first_name: p.first_name ?? null, last_name: p.last_name ?? null } : null;
    })
    .filter((p): p is Recipient => !!p && !!p.id);

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, recipients: 0, emailed: 0 });
  }

  // 4. Insert an admin→member message into each opted-in member's inbox.
  const rows = recipients.map((r) => ({
    member_id: r.id,
    from_name: "ABCAC Admin",
    sender_role: "admin",
    subject,
    body: message,
    is_read: false,
  }));

  const { error: insertErr } = await admin.from("messages").insert(rows);
  if (insertErr) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 4b. BEST-EFFORT: also fan a member-facing in-app notification out to the
  // membership so the Notifications stream has an admin-driven producer (not
  // just the DB triggers). Only the ABCAC-announcements audience is governed by
  // the abcac_announcements preference the broadcast honors, so we scope the
  // notification fan-out to that audience. A broadcast failure must NEVER fail
  // the announcement send — swallow it.
  if (audience === "abcac_announcements") {
    try {
      await broadcastToMembers(admin, {
        title: subject,
        body: message,
        link: "/account",
        category: "announcement",
      });
    } catch {
      // best-effort: the inbox message already delivered; ignore notify errors.
    }
  }

  // 5. Best-effort email each recipient via inline Resend (no-op without a key).
  let emailed = 0;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const from = process.env.RESEND_FROM_EMAIL ?? "ABCAC <noreply@abcac.org>";
    const safeSubject = escapeHtml(subject);
    const bodyHtml = escapeHtml(message).replace(/\r?\n/g, "<br/>");
    await Promise.all(
      recipients
        .filter((r) => !!r.email)
        .map(async (r) => {
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from,
                to: r.email,
                subject: safeSubject,
                html: `<p><strong>${safeSubject}</strong></p><p>${bodyHtml}</p>
                       <hr/><p style="color:#888;font-size:12px">You're receiving this because you opted in to ${escapeHtml(label)} in your ABCAC account settings.</p>`,
              }),
            });
            if (res.ok) emailed += 1;
          } catch {
            // best-effort: a single failed email never fails the broadcast.
          }
        }),
    );
  }

  // 6. Best-effort audit log.
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "announcement_broadcast",
      target_table: "messages",
      target_id: null,
      details: { audience, label, subject, recipients: recipients.length, emailed },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, recipients: recipients.length, emailed });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
