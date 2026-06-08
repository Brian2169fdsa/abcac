import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";
import { checkRateLimit, getClientIp } from "@/lib/public-rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Per-IP abuse protection (in-memory v1; see public-rate-limit.ts).
  const ip = getClientIp(req);
  const rl = checkRateLimit("contact", ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    company_website?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Honeypot: real forms never send `company_website`. Bots that auto-fill
  // hidden fields do — silently succeed without doing any work.
  if (body?.company_website) {
    return NextResponse.json({ ok: true });
  }

  const { name, email, phone, message } = body ?? {};
  if (!name || !email || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  // Defensive length caps (public endpoint).
  if (name.length > 200 || email.length > 320 || (phone ?? "").length > 50 || message.length > 4000) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
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
