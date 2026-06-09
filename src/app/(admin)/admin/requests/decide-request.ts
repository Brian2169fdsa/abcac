"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";
import { isAdminRole } from "@/lib/auth/roles";

// Admin approve/deny decisions for the request tables that are NOT verification
// (verification keeps its dedicated one-click decideVerification flow). This
// server action is ADMIN-GATED (re-checks portal_role='admin' on the
// cookie-bound session; never trusts the client) and for each decision it:
//   (a) writes the result + a decided timestamp on the row,
//   (b) records a best-effort admin_audit_log entry,
//   (c) emails the member/requester the outcome inline via Resend
//       (graceful no-op when RESEND_API_KEY is unset).
//
// For reciprocity OUT-of-Arizona transfers that are APPROVED, it also sends an
// outbound notification email to the destination board email captured on the
// request.

type DecisionResult = { ok: true } | { ok: false; error: string };

const FROM = process.env.RESEND_FROM_EMAIL ?? "ABCAC <noreply@abcac.org>";

const SUPPORTED = new Set(["name_change_requests", "reciprocity_requests"]);

export async function decideRequest(
  table: string,
  id: string,
  decision: "approve" | "deny" | "reopen",
  note?: string,
): Promise<DecisionResult> {
  if (!id || !SUPPORTED.has(table)) return { ok: false, error: "bad_request" };
  if (decision !== "approve" && decision !== "deny" && decision !== "reopen") {
    return { ok: false, error: "bad_request" };
  }

  // 1. Admin gate.
  const sb = createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole(profile?.portal_role)) return { ok: false, error: "forbidden" };

  const admin = createSupabaseAdminClient();

  // 2. Write the decision + timestamp. completed|rejected map onto the existing
  //    status vocabulary so existing queues/badges stay consistent.
  const status = decision === "approve" ? "completed" : decision === "deny" ? "rejected" : "pending";
  const now = new Date().toISOString();

  // reviewed_by / decided_at exist ONLY on reciprocity_requests (migration 017).
  // name_change_requests (migration 001) has only status/admin_notes/
  // submitted_at/reviewed_at, so writing those columns to it errors
  // ("column does not exist") and the decision never persists.
  const hasReviewerCols = table === "reciprocity_requests";
  const patch: Record<string, unknown> = { status };
  if (decision === "reopen") {
    patch.reviewed_at = null;
    if (hasReviewerCols) {
      patch.reviewed_by = null;
      patch.decided_at = null;
    }
  } else {
    patch.reviewed_at = now;
    if (hasReviewerCols) {
      patch.reviewed_by = user.id;
      patch.decided_at = now;
    }
    if (note) patch.admin_notes = note;
  }

  const { data: row, error } = await admin
    .from(table)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  // 2b. Approving a name change must also write the requested new name back to
  //     the member's canonical profile — otherwise approval is cosmetic and the
  //     displayed/certificate name stays stale. `new_name` is a single full-name
  //     string; split it into first/last to match the profiles columns.
  //     Service-role write, already guarded by the admin re-check above.
  if (decision === "approve" && table === "name_change_requests" && row?.member_id) {
    const fullName = String(row.new_name ?? "").trim();
    if (fullName) {
      const parts = fullName.split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
      try {
        await admin
          .from("profiles")
          .update({ first_name: firstName, last_name: lastName })
          .eq("id", row.member_id);
      } catch (err) {
        console.error("name change profile update skipped:", err);
      }
    }
  }

  // 3. Best-effort audit log.
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: `${table}_${status}`,
      target_table: table,
      target_id: id,
      details: note ? { note } : null,
    });
  } catch { /* best-effort */ }

  // Reopen does not email anyone.
  if (decision === "reopen") return { ok: true };

  // 4. Resolve the member's email for the outcome notification.
  let memberEmail: string | null = null;
  let memberName = "there";
  if (row?.member_id) {
    const { data: m } = await admin
      .from("profiles")
      .select("email,first_name,last_name")
      .eq("id", row.member_id)
      .maybeSingle();
    memberEmail = m?.email ?? null;
    memberName = [m?.first_name, m?.last_name].filter(Boolean).join(" ") || "there";
  }

  const approved = decision === "approve";

  // 5a. Member outcome email (best-effort, graceful without a key).
  if (memberEmail) {
    if (table === "name_change_requests") {
      const newName = row?.new_name ?? "";
      await sendEmail(
        memberEmail,
        approved
          ? `${siteConfig.shortName} name change approved`
          : `${siteConfig.shortName} name change update`,
        memberName,
        approved
          ? `Your request to change your legal name on file to <strong>${escapeHtml(newName)}</strong> has been <strong>approved</strong>. Your ${escapeHtml(siteConfig.shortName)} records will be updated accordingly.`
          : `Your request to change your legal name on file to <strong>${escapeHtml(newName)}</strong> could not be approved at this time.${note ? ` <br/><br/>Reviewer note: ${escapeHtml(note)}` : ""} Please contact us if you have questions.`,
      );
    } else if (table === "reciprocity_requests") {
      const out = row?.direction === "out_of_az";
      const where = row?.destination ?? (out ? "the destination board" : "Arizona");
      await sendEmail(
        memberEmail,
        approved
          ? `${siteConfig.shortName} IC&RC reciprocity approved`
          : `${siteConfig.shortName} IC&RC reciprocity update`,
        memberName,
        approved
          ? `Your IC&RC reciprocity ${out ? "transfer OUT of Arizona" : "transfer INTO Arizona"} request${row?.credential ? ` for <strong>${escapeHtml(row.credential)}</strong>` : ""} has been <strong>approved</strong>.${out ? ` We have notified <strong>${escapeHtml(where)}</strong> of your transfer.` : ` ${escapeHtml(siteConfig.shortName)} will follow up with next steps.`}`
          : `Your IC&RC reciprocity request${row?.credential ? ` for <strong>${escapeHtml(row.credential)}</strong>` : ""} could not be approved at this time.${note ? ` <br/><br/>Reviewer note: ${escapeHtml(note)}` : ""} Please contact us if you have questions.`,
      );
    }
  }

  // 5b. OUT-transfer approval → notify the destination board.
  if (table === "reciprocity_requests" && approved && row?.direction === "out_of_az" && row?.destination_board_email) {
    const board = row?.destination ?? "your board";
    await sendEmail(
      row.destination_board_email,
      `IC&RC reciprocity transfer from ${siteConfig.shortName}`,
      board,
      `${escapeHtml(siteConfig.shortName)} (an IC&RC member board) is initiating an outbound IC&RC reciprocity transfer of one of our certified counselors${row?.credential ? ` holding the <strong>${escapeHtml(row.credential)}</strong> credential` : ""} to your board.<br/><br/>Please reply to this message to coordinate receipt of the transfer documentation. The $150 IC&RC transfer fee has been collected by ${escapeHtml(siteConfig.shortName)}.`,
    );
  }

  return { ok: true };
}

async function sendEmail(to: string, subject: string, name: string, bodyHtml: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return; // graceful degradation — decision is already saved.
  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">${escapeHtml(siteConfig.shortName)}</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>${bodyHtml}</p>
  <p style="color:#6b7280;font-size:14px">If you have questions, contact us at
     <a href="${escapeHtml(siteConfig.contact.emailHref)}">${escapeHtml(siteConfig.contact.email)}</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${escapeHtml(siteConfig.shortName)} &mdash; ${escapeHtml(siteConfig.name)}</p>
</div>`.trim();
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
  } catch { /* best-effort */ }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
