import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

// PUBLIC (no-login) verification-request submit endpoint.
// A third party (employer, board, agency) asks ABCAC to confirm a counselor's
// certification. We validate the input, insert a verification_requests row via
// the service-role client (RLS: anon has no INSERT policy — service role only),
// mark it source='public', and email the requester a best-effort confirmation.
export async function POST(req: Request) {
  let body: {
    requesterName?: string;
    requesterEmail?: string;
    organization?: string;
    subjectName?: string;
    subjectCertNumber?: string;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const requesterName = (body.requesterName ?? "").trim();
  const requesterEmail = (body.requesterEmail ?? "").trim();
  const organization = (body.organization ?? "").trim();
  const subjectName = (body.subjectName ?? "").trim();
  const subjectCertNumber = (body.subjectCertNumber ?? "").trim();
  const reason = (body.reason ?? "").trim();

  // Required: requester name + email, a reason, and SOMETHING to verify
  // (either the counselor's name or their certification number).
  if (!requesterName || !requesterEmail || !reason) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!subjectName && !subjectCertNumber) {
    return NextResponse.json({ error: "missing_subject" }, { status: 400 });
  }
  // Basic email shape + length guards (defensive — public endpoint).
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(requesterEmail) || requesterEmail.length > 320) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (
    requesterName.length > 200 ||
    organization.length > 200 ||
    subjectName.length > 200 ||
    subjectCertNumber.length > 100 ||
    reason.length > 4000
  ) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  // Insert via the service-role client (bypasses RLS; anon has no INSERT policy).
  try {
    const admin = createSupabaseAdminClient();
    const purpose = reason;
    const { error } = await admin.from("verification_requests").insert({
      member_id: null,
      source: "public",
      requester_name: requesterName,
      requester_email: requesterEmail,
      organization: organization || null,
      subject_name: subjectName || null,
      subject_cert_number: subjectCertNumber || null,
      // Map onto the existing NOT NULL portal columns so legacy admin views and
      // triggers keep working: recipient_* = the requester, purpose = reason.
      recipient_name: requesterName,
      recipient_email: requesterEmail,
      purpose,
      notes: reason,
      status: "pending",
    });
    if (error) throw error;
  } catch (err) {
    console.error("verification insert failed:", err);
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }

  // Best-effort confirmation email to the requester (inline Resend, graceful).
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const subjectLine = subjectName || subjectCertNumber;
      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">${escapeHtml(siteConfig.shortName)} Verification Request Received</h2>
  <p>Hi ${escapeHtml(requesterName)},</p>
  <p>We have received your request to verify a certification with the
     ${escapeHtml(siteConfig.name)}. Our team will review it and respond to this
     email address with the outcome.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:6px 0;color:#6b7280">Verifying</td>
        <td style="padding:6px 0;text-align:right">${escapeHtml(subjectLine)}</td></tr>
    ${subjectCertNumber ? `<tr><td style="padding:6px 0;color:#6b7280">Certification #</td><td style="padding:6px 0;text-align:right">${escapeHtml(subjectCertNumber)}</td></tr>` : ""}
    ${organization ? `<tr><td style="padding:6px 0;color:#6b7280">Organization</td><td style="padding:6px 0;text-align:right">${escapeHtml(organization)}</td></tr>` : ""}
  </table>
  <p style="color:#6b7280;font-size:14px">If you have questions, contact us at
     <a href="${escapeHtml(siteConfig.contact.emailHref)}">${escapeHtml(siteConfig.contact.email)}</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${escapeHtml(siteConfig.shortName)} &mdash; ${escapeHtml(siteConfig.name)}</p>
</div>`.trim();

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "ABCAC <noreply@abcac.org>",
          to: requesterEmail,
          subject: `${siteConfig.shortName} verification request received`,
          html,
        }),
      });
    } catch {
      // Email is best-effort — the request is already persisted.
    }
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
