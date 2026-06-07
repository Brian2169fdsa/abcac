"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";

type DecisionResult = { ok: true } | { ok: false; error: string };

// Admin one-click Verified / Not Verified decision for a verification_requests
// row. ADMIN-GATED: re-checks portal_role='admin' on the cookie-bound session
// (never trusts the client). Writes verification_result + verified_at + status,
// records an audit-log entry, and emails the requester the outcome inline.
export async function decideVerification(
  id: string,
  result: "verified" | "not_verified",
): Promise<DecisionResult> {
  if (!id || (result !== "verified" && result !== "not_verified")) {
    return { ok: false, error: "bad_request" };
  }

  // 1. Admin gate — the cookie-bound client respects RLS; confirm the caller is
  //    an admin before doing anything with the service role.
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.portal_role !== "admin") return { ok: false, error: "forbidden" };

  // 2. Write the decision. Map onto the request status so existing queues stay
  //    consistent: verified -> completed, not_verified -> rejected.
  const status = result === "verified" ? "completed" : "rejected";
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("verification_requests")
    .update({
      verification_result: result,
      verified_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status,
    })
    .eq("id", id)
    .select("requester_email,recipient_email,requester_name,recipient_name,subject_name,subject_cert_number,purpose")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  // 3. Best-effort audit log.
  try {
    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: `verification_requests_${result}`,
      target_table: "verification_requests",
      target_id: id,
      details: null,
    });
  } catch {
    /* best-effort */
  }

  // 4. Email the requester the outcome inline (graceful if no key).
  const to = row?.requester_email || row?.recipient_email || null;
  const resendKey = process.env.RESEND_API_KEY;
  if (to && resendKey) {
    try {
      const name = row?.requester_name || row?.recipient_name || "there";
      const subjectName = row?.subject_name || "";
      const certNumber = row?.subject_cert_number || "";
      const subjectLine = subjectName || certNumber || "the requested certification";
      const verified = result === "verified";
      const outcome = verified
        ? `We can confirm that <strong>${escapeHtml(subjectLine)}</strong> holds a valid ${escapeHtml(siteConfig.shortName)} certification in good standing.`
        : `We are unable to verify a valid ${escapeHtml(siteConfig.shortName)} certification for <strong>${escapeHtml(subjectLine)}</strong> based on the information provided.`;

      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">${escapeHtml(siteConfig.shortName)} Certification Verification</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>${outcome}</p>
  ${certNumber ? `<p style="color:#6b7280">Certification number: ${escapeHtml(certNumber)}</p>` : ""}
  <p style="color:#6b7280;font-size:14px">If you have questions, contact us at
     <a href="${escapeHtml(siteConfig.contact.emailHref)}">${escapeHtml(siteConfig.contact.email)}</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${escapeHtml(siteConfig.shortName)} &mdash; ${escapeHtml(siteConfig.name)}</p>
</div>`.trim();

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "ABCAC <noreply@abcac.org>",
          to,
          subject: verified
            ? `${siteConfig.shortName} certification verified`
            : `${siteConfig.shortName} certification verification result`,
          html,
        }),
      });
    } catch {
      /* email is best-effort — the decision is already saved */
    }
  }

  return { ok: true };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
