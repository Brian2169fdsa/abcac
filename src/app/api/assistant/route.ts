export const runtime = "nodejs";

import type Anthropic from "@anthropic-ai/sdk";
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { isAssistantConfigured } from "@/lib/assistant/anthropic";
import { runAssistant, type AssistantTool, type ToolExecutor } from "@/lib/assistant/run";
import { getMemberTools, getMemberExecutors } from "@/lib/assistant/member-tools";
import { getAdminTools, getAdminExecutors } from "@/lib/assistant/admin-tools";
import { getWebsiteTools, getWebsiteExecutors } from "@/lib/assistant/website-tools";
import { isAdminRole } from "@/lib/auth/roles";
import {
  WEBSITE_SYSTEM_DEFAULT,
  MEMBER_SYSTEM_DEFAULT,
  ADMIN_SYSTEM_DEFAULT,
} from "@/lib/assistant/prompts";
import {
  checkRateLimit,
  callerIp,
  checkConversationLength,
} from "@/lib/assistant/rate-limit";

/**
 * POST /api/assistant — the conversational assistant endpoint (all 3 surfaces).
 *
 * Flow:
 *  1. If ANTHROPIC_API_KEY is missing → 503 { error: "assistant_not_configured" }
 *     (the widget degrades gracefully). Build passes with no env vars.
 *  2. Parse + sanitize the posted history to text turns only (no injected
 *     tool_result blocks or non user/assistant roles).
 *  3. PUBLIC surface: if surface === "website", serve the Level-1 public
 *     assistant with NO personal-data tools — it never requires a session and
 *     never reads any member's data. (Even a signed-in visitor on a public page
 *     gets the public, data-free assistant for this surface.)
 *  4. Otherwise authenticate via the Supabase cookie session. No session → 401.
 *     Admins on the "admin" surface get the admin toolset (re-checks is_admin()
 *     on every write); everyone else gets the member toolset (own-rows-only,
 *     RLS-scoped).
 *
 * WP-D guardrails applied to ALL surfaces:
 *  - Per-caller rate limit (per IP for public, per user id for authed).
 *  - Conversation length / input-size cap (reject overly long input → 400).
 *  - Bounded max_tokens (ASSISTANT_MAX_TOKENS) + capped tool loop in run.ts.
 *  - 429 with a friendly message when rate limited.
 */

interface IncomingMessage {
  role?: string;
  content?: unknown;
}

function sanitizeMessages(raw: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(raw)) return [];
  const out: Anthropic.MessageParam[] = [];
  for (const m of raw as IncomingMessage[]) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const text =
      typeof m?.content === "string"
        ? m.content
        : Array.isArray(m?.content)
          ? (m.content as Array<{ text?: unknown }>)
              .map((b) => (typeof b?.text === "string" ? b.text : ""))
              .join("")
          : "";
    const trimmed = text.trim();
    if (trimmed) out.push({ role, content: trimmed });
  }
  // The API requires the first message to be from the user.
  while (out.length > 0 && out[0].role !== "user") out.shift();
  return out;
}

function rateLimited(retryAfter: number): Response {
  return Response.json(
    {
      error: "rate_limited",
      message:
        "You're sending messages too quickly. Please wait a moment and try again.",
      retryAfter,
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: Request): Promise<Response> {
  // 1. Graceful degradation when the key is absent.
  if (!isAssistantConfigured()) {
    return Response.json({ error: "assistant_not_configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const requested = (body as { surface?: unknown })?.surface;
  const messages = sanitizeMessages((body as { messages?: unknown })?.messages);
  if (messages.length === 0) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // WP-D: reject overly long conversations/inputs before any upstream spend.
  const lengthCheck = checkConversationLength(messages);
  if (!lengthCheck.ok) {
    return Response.json(
      { error: "input_too_large", message: lengthCheck.error },
      { status: 400 },
    );
  }

  // ── PUBLIC (Level 1) surface ────────────────────────────────────────────
  // No session required, NO personal-data tools, never reads any member's data.
  if (requested === "website") {
    const limit = checkRateLimit(`ip:${callerIp(req)}`);
    if (!limit.ok) return rateLimited(limit.retryAfter);

    try {
      const result = await runAssistant({
        system: WEBSITE_SYSTEM_DEFAULT, // SWAP: MASTER-PLAN §3.A (later WP)
        messages,
        tools: getWebsiteTools(),
        executors: getWebsiteExecutors(),
      });
      return Response.json({ reply: result.reply, actions: result.actions });
    } catch (err) {
      const message = err instanceof Error ? err.message : "assistant_error";
      return Response.json({ error: "assistant_error", detail: message }, { status: 500 });
    }
  }

  // ── AUTHENTICATED (Level 2/3) surfaces ──────────────────────────────────
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // WP-D: rate-limit authed callers per user id.
  const limit = checkRateLimit(`user:${user.id}`);
  if (!limit.ok) return rateLimited(limit.retryAfter);

  // Resolve role + the requested surface (member vs admin).
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role,first_name,last_name,cert_status,account_status")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = isAdminRole(profile?.portal_role);
  const useAdmin = isAdmin && requested === "admin";

  let system: string;
  let tools: AssistantTool[];
  let executors: Record<string, ToolExecutor>;

  if (useAdmin) {
    const admin = createSupabaseAdminClient();
    system = ADMIN_SYSTEM_DEFAULT; // SWAP: MASTER-PLAN §3.B (later WP)
    tools = getAdminTools();
    executors = getAdminExecutors({ sb, admin, uid: user.id });
  } else {
    // Member surface: own-rows-only, RLS-scoped. Inject the member's name +
    // status into the system prompt context.
    const name =
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      user.email ||
      "Member";
    system =
      `${MEMBER_SYSTEM_DEFAULT}\n\nContext: You are speaking with ${name}` + // SWAP: MASTER-PLAN §3.C (later WP)
      ` (account status: ${profile?.account_status ?? "unknown"},` +
      ` certification status: ${profile?.cert_status ?? "unknown"}).`;
    tools = getMemberTools();
    executors = getMemberExecutors({ sb, uid: user.id });
  }

  try {
    const result = await runAssistant({ system, messages, tools, executors });
    return Response.json({ reply: result.reply, actions: result.actions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "assistant_error";
    return Response.json({ error: "assistant_error", detail: message }, { status: 500 });
  }
}
