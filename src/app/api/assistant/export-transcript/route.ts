import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/public-rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/assistant/export-transcript — let a public chat visitor email
 * themselves their Q&A transcript.
 *
 * Body: { email: string, messages: { role: "user"|"assistant", content: string }[] }
 *
 * Mirrors /api/contact: per-IP rate limit (429 + Retry-After) and email
 * delivery via an inline Resend fetch. No account/personal data is read or
 * included — only the messages the caller posts. When RESEND_API_KEY is unset
 * we return 503 so the UI can fall back to copy/download.
 */

// Defensive caps for a public, unauthenticated endpoint.
const MAX_MESSAGES = 100;
const MAX_TOTAL_CONTENT = 50_000; // ~50KB of transcript text
const MAX_EMAIL_LENGTH = 320;

// Pragmatic, well-formed-email check (not full RFC 5322).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IncomingMessage {
  role?: unknown;
  content?: unknown;
}

export async function POST(req: Request) {
  // Per-IP abuse protection (in-memory v1; see public-rate-limit.ts).
  const ip = getClientIp(req);
  const rl = checkRateLimit("export-transcript", ip);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many requests. Please wait a moment and try again.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { email?: unknown; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const rawMessages = body?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const messages: { role: "user" | "assistant"; content: string }[] = [];
  let totalContent = 0;
  for (const m of rawMessages as IncomingMessage[]) {
    if (typeof m?.content !== "string") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    const role = m?.role === "assistant" ? "assistant" : "user";
    totalContent += m.content.length;
    if (totalContent > MAX_TOTAL_CONTENT) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    messages.push({ role, content: m.content });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    // No email provider configured — let the UI fall back to copy/download.
    return NextResponse.json({ error: "email_not_configured" }, { status: 503 });
  }

  const html = buildTranscriptHtml(messages);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ABCAC <noreply@abcac.org>",
        to: email,
        subject: "Your ABCAC questions & answers",
        html,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "delivery_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

function buildTranscriptHtml(
  messages: { role: "user" | "assistant"; content: string }[],
): string {
  const turns = messages
    .map((m) => {
      const label = m.role === "assistant" ? "ABCAC Assistant:" : "You:";
      const content = escapeHtml(m.content).replace(/\r?\n/g, "<br />");
      return `<p><strong>${label}</strong></p><p>${content}</p>`;
    })
    .join("\n");
  return `<h1>Your ABCAC questions &amp; answers</h1>\n${turns}`;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}
