import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/public-rate-limit";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

interface Attachment {
  filename: string;
  content: string; // base64
}

export async function POST(req: Request) {
  // Per-IP abuse protection, matching the other public form endpoints.
  const ip = getClientIp(req);
  const rl = checkRateLimit("board-application", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: Awaited<ReturnType<Request["json"]>>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const {
    fullName,
    preferredName,
    email,
    phone,
    mailingAddress,
    jobTitle,
    organization,
    yearsInField,
    certifications,
    certificationOther,
    whyJoin,
    strengths,
    experience,
    quarterlyMeetings,
    quarterlyExplain,
    committees,
    committeesExplain,
    attachments,
  } = body ?? {};

  if (!fullName || !email || !phone || !whyJoin) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const certs = Array.isArray(certifications) ? certifications.join(", ") : "";
  const summaryRows: [string, string][] = [
    ["Full Name", fullName],
    ["Preferred Name", preferredName],
    ["Email", email],
    ["Phone", phone],
    ["Mailing Address", mailingAddress],
    ["Current Job Title", jobTitle],
    ["Organization / Employer", organization],
    ["Years in Field", yearsInField],
    ["Certifications", [certs, certificationOther].filter(Boolean).join(certs && certificationOther ? ", Other: " : "Other: ")],
    ["Why join the Board", whyJoin],
    ["Strengths / skills", strengths],
    ["Certification / credentialing / ethics experience", experience],
    ["Available for quarterly meetings", [quarterlyMeetings, quarterlyExplain].filter(Boolean).join(" — ")],
    ["Willing to join committees", [committees, committeesExplain].filter(Boolean).join(" — ")],
  ];

  const html = `<h2>ABCAC Board Member Application</h2>${summaryRows
    .map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong><br>${escapeHtml(v ?? "—") || "—"}</p>`)
    .join("")}`;

  const validAttachments: Attachment[] = Array.isArray(attachments)
    ? attachments.filter((a: Attachment) => a && a.filename && a.content)
    : [];

  // Source of truth: ALWAYS persist the text summary to contact_messages so the
  // admin Inbox has a record, regardless of the (best-effort) email outcome.
  // NOTE: attachments (resume/references) are sent only in the email below — the
  // persisted summary records their filenames but not their content.
  const message = `BOARD MEMBER APPLICATION\n\n${summaryRows.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n")}${
    validAttachments.length ? `\n\nAttachments submitted: ${validAttachments.map((a) => a.filename).join(", ")}` : ""
  }`;
  let persisted = false;
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("contact_messages")
      .insert({ name: fullName, email, phone: phone ?? null, message });
    if (error) throw error;
    persisted = true;
  } catch {
    // Persistence failed — fall through; we may still notify via email below.
  }

  // Best-effort notification: email the office via Resend (with attachments).
  let emailed = false;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ABCAC Website <noreply@abcac.org>",
          to: siteConfig.contact.email,
          reply_to: email,
          subject: `Board Member Application — ${fullName}`,
          html,
          attachments: validAttachments.map((a) => ({ filename: a.filename, content: a.content })),
        }),
      });
      emailed = res.ok;
    } catch {
      // Ignore — persistence above is the durable record.
    }
  }

  // Success if we either persisted the record or delivered the email.
  if (persisted || emailed) return NextResponse.json({ ok: true });

  return NextResponse.json({ error: "delivery_unavailable" }, { status: 502 });
}

function escapeHtml(s: string) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}
