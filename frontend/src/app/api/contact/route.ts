import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { name, email, phone, message } = await req.json();
  if (!name || !email || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;

  // Preferred path: email ABCAC via Resend.
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "ABCAC Website <noreply@abcac.org>",
          to: siteConfig.contact.email,
          reply_to: email,
          subject: `Website contact from ${name}`,
          html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
                 <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                 <p><strong>Phone:</strong> ${escapeHtml(phone ?? "—")}</p>
                 <p><strong>Message:</strong></p><p>${escapeHtml(message)}</p>`,
        }),
      });
      if (res.ok) return NextResponse.json({ ok: true });
    } catch {
      // fall through to Supabase
    }
  }

  // Fallback: persist to an existing contact_messages table if present.
  try {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("contact_messages").insert({ name, email, phone: phone ?? null, message });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    // Neither path available — surface an error so the form shows the retry message.
    return NextResponse.json({ error: "delivery_unavailable" }, { status: 502 });
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
