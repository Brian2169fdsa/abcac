"use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/site-config";
import { isAdminRole } from "@/lib/auth/roles";

type SendResult = { ok: true } | { ok: false; error: string };

// ADMIN-GATED credentials email sent when an admin approves a new member
// account. Mirrors the decide-verification.ts pattern: re-checks
// portal_role='admin' on the cookie-bound session (never trusts the client),
// fetches the member's email server-side, then emails inline via Resend
// (graceful no-op without RESEND_API_KEY).
//
// PASSWORD DECISION: we do NOT email a plaintext password — Supabase stores
// credentials hashed, so we cannot recover it. The email tells the member their
// USERNAME IS THEIR EMAIL, links them to the portal, and instructs them to sign
// in with the password they chose at signup (with a forgot-password path).
export async function sendApprovalCredentialsEmail(memberId: string): Promise<SendResult> {
  if (!memberId) return { ok: false, error: "bad_request" };

  // 1. Admin gate.
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const { data: caller } = await sb
    .from("profiles")
    .select("portal_role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRole(caller?.portal_role)) return { ok: false, error: "forbidden" };

  // 2. Fetch the member's email server-side (service role — the username we
  //    email is authoritative, not supplied by the client).
  const admin = createSupabaseAdminClient();
  const { data: member } = await admin
    .from("profiles")
    .select("email,first_name")
    .eq("id", memberId)
    .maybeSingle();
  const to = member?.email || null;
  if (!to) return { ok: false, error: "no_email" };

  // 3. Inline Resend — graceful no-op when unconfigured.
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: true };

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const loginUrl = `${origin}/login`;
  const accountUrl = `${origin}/account`;
  const forgotUrl = `${origin}/login`;
  const name = member?.first_name || "there";

  const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="color:#1a3c5e">Your ${escapeHtml(siteConfig.shortName)} account is approved</h2>
  <p>Hi ${escapeHtml(name)},</p>
  <p>Good news — your ${escapeHtml(siteConfig.name)} member portal account has been approved. You can now sign in and access the full portal.</p>
  <p style="background:#f3f4f6;border-radius:8px;padding:14px 16px">
    <strong>Username:</strong> ${escapeHtml(to)}<br/>
    <strong>Password:</strong> the password you chose when you signed up
  </p>
  <p>
    <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#1a3c5e;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Sign in to the portal</a>
  </p>
  <p style="color:#6b7280;font-size:14px">After signing in you can manage your account at
     <a href="${escapeHtml(accountUrl)}">${escapeHtml(accountUrl)}</a>.</p>
  <p style="color:#6b7280;font-size:14px">Forgot your password? Reset it from the
     <a href="${escapeHtml(forgotUrl)}">sign-in page</a>.</p>
  <p style="color:#6b7280;font-size:14px">Questions? Contact us at
     <a href="${escapeHtml(siteConfig.contact.emailHref)}">${escapeHtml(siteConfig.contact.email)}</a>.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:24px">${escapeHtml(siteConfig.shortName)} &mdash; ${escapeHtml(siteConfig.name)}</p>
</div>`.trim();

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "ABCAC <noreply@abcac.org>",
        to,
        subject: `Your ${siteConfig.shortName} account is approved`,
        html,
      }),
    });
  } catch {
    // Email is best-effort — the approval itself is already saved client-side.
  }

  return { ok: true };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
