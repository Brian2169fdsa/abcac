import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

interface Attachment {
  filename: string;
  content: string; // base64
}

export async function POST(req: Request) {
  const body = await req.json();
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

  const resendKey = process.env.RESEND_API_KEY;

  // Preferred path: email the office via Resend (with resume/reference attachments).
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
      if (res.ok) return NextResponse.json({ ok: true });
    } catch {
      // fall through to Supabase
    }
  }

  // Fallback: persist the text summary to contact_messages if present (attachments dropped).
  try {
    const admin = createSupabaseAdminClient();
    const message = `BOARD MEMBER APPLICATION\n\n${summaryRows.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n")}${
      validAttachments.length ? `\n\nAttachments submitted: ${validAttachments.map((a) => a.filename).join(", ")}` : ""
    }`;
    const { error } = await admin
      .from("contact_messages")
      .insert({ name: fullName, email, phone: phone ?? null, message });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "delivery_unavailable" }, { status: 502 });
  }
}

function escapeHtml(s: string) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}
