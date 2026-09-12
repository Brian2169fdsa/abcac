"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";
import { isAdminRole } from "@/lib/auth/roles";
import { generateVerificationLetterPdf } from "@/lib/verification-letter-pdf";

type DecisionResult = { ok: true } | { ok: false; error: string };

// Admin one-click Verified / Not Verified decision for a verification_requests
// row. ADMIN-GATED: re-checks portal_role='admin' on the cookie-bound session
// (never trusts the client). Writes verification_result + verified_at + status,
// generates a downloadable letter PDF (stored for the member when the request
// came from the portal), emails the requester the outcome with the letter
// attached, and — when the request has a member — separately notifies that
// member directly (previously only the third-party requester/recipient was
// ever emailed).
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
  if (!isAdminRole(profile?.portal_role)) return { ok: false, error: "forbidden" };

  // 2. Write the decision. Map onto the request status so existing queues stay
  //    consistent: verified -> completed, not_verified -> rejected.
  const status = result === "verified" ? "completed" : "rejected";
  const decidedAt = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("verification_requests")
    .update({
      verification_result: result,
      verified_at: decidedAt,
      completed_at: decidedAt,
      status,
    })
    .eq("id", id)
    .select(
      "member_id,requester_email,recipient_email,requester_name,recipient_name,subject_name,subject_cert_number,purpose",
    )
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

  // 4. Generate the decision letter PDF. When the request has a member, upload
  //    it into their member-documents folder (same read policy that already
  //    serves certificates and name-change docs to them) and save the path.
  let letterBytes: Uint8Array | null = null;
  let letterBase64: string | null = null;
  try {
    letterBytes = await generateVerificationLetterPdf({
      subjectName: row?.subject_name || "",
      subjectCertNumber: row?.subject_cert_number,
      purpose: row?.purpose,
      recipientName: row?.recipient_name,
      result,
      decidedDate: decidedAt,
    });
    letterBase64 = Buffer.from(letterBytes).toString("base64");
  } catch {
    /* letter generation is best-effort — the decision is already saved */
  }

  let memberEmail: string | null = null;
  let memberName = "there";
  if (row?.member_id) {
    try {
      const { data: memberProfile } = await admin
        .from("profiles")
        .select("email,first_name,last_name")
        .eq("id", row.member_id)
        .maybeSingle();
      memberEmail = memberProfile?.email ?? null;
      memberName = [memberProfile?.first_name, memberProfile?.last_name].filter(Boolean).join(" ") || "there";

      if (letterBytes) {
        const letterPath = `${row.member_id}/verification-letters/${id}.pdf`;
        const { error: uploadErr } = await admin.storage
          .from("member-documents")
          .upload(letterPath, letterBytes, { contentType: "application/pdf", upsert: true });
        if (!uploadErr) {
          await admin.from("verification_requests").update({ letter_path: letterPath }).eq("id", id);
        }
      }
    } catch {
      /* storage upload is best-effort — the decision + letter data are already saved */
    }
  }

  // 5. Email the requester the outcome inline, with the letter attached (graceful if no key).
  const to = row?.requester_email || row?.recipient_email || null;
  const resendKey = process.env.RESEND_API_KEY;
  const subjectName = row?.subject_name || "";
  const certNumber = row?.subject_cert_number || "";
  const subjectLine = subjectName || certNumber || "the requested certification";
  const verified = result === "verified";

  if (to && resendKey) {
    try {
      const name = row?.requester_name || row?.recipient_name || "there";
      const outcome = verified
        ? `We can confirm that <strong>${escapeHtml(subjectLine)}</strong> holds a valid ${escapeHtml(siteConfig.shortName)} certification in good standing.`
        : `We are unable to verify a valid ${escapeHtml(siteConfig.shortName)} certification for <strong>${escapeHtml(subjectLine)}</strong> based on the information provided.`;

      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">${escapeHtml(siteConfig.shortName)} Certification Verification</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>${outcome}</p>
  ${certNumber ? `<p style="color:#6b7280">Certification number: ${escapeHtml(certNumber)}</p>` : ""}
  <p style="color:#6b7280">A copy of the verification letter is attached to this email for your records.</p>
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
          ...(letterBase64
            ? { attachments: [{ filename: "abcac-verification-letter.pdf", content: letterBase64 }] }
            : {}),
        }),
      });
    } catch {
      /* email is best-effort — the decision is already saved */
    }
  }

  // 6. Separately notify the member directly — previously a member who
  //    submitted their own verification request never received an email at
  //    all (only the third-party requester/recipient did). Skip if the
  //    member's own address is also the one already emailed above.
  if (memberEmail && resendKey && memberEmail !== to) {
    try {
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">Your verification request has been decided</h2>
  <p>Hi ${escapeHtml(memberName)},</p>
  <p>Your ${escapeHtml(siteConfig.shortName)} verification request${row?.recipient_name ? ` for ${escapeHtml(row.recipient_name)}` : ""} has been reviewed. Result: <strong>${verified ? "Verified" : "Not Verified"}</strong>.</p>
  <p style="color:#6b7280">A copy of the verification letter is attached, and you can also download it any time from the Requests page in your member portal.</p>
  <p style="color:#6b7280;font-size:14px">If you have questions, contact us at
     <a href="${escapeHtml(siteConfig.contact.emailHref)}">${escapeHtml(siteConfig.contact.email)}</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${escapeHtml(siteConfig.shortName)} &mdash; ${escapeHtml(siteConfig.name)}</p>
</div>`.trim();

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "ABCAC <noreply@abcac.org>",
          to: memberEmail,
          subject: `Your ${siteConfig.shortName} verification request has been decided`,
          html,
          ...(letterBase64
            ? { attachments: [{ filename: "abcac-verification-letter.pdf", content: letterBase64 }] }
            : {}),
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
