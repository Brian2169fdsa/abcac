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

/**
 * POST /api/assistant — the conversational assistant endpoint.
 *
 * Flow:
 *  1. If ANTHROPIC_API_KEY is missing → 503 { error: "assistant_not_configured" }
 *     (the widget degrades gracefully). Build passes with no env vars.
 *  2. Authenticate via the Supabase cookie session. No session → 401.
 *  3. Resolve the caller's role from their profile. Admins get the admin
 *     toolset (which itself re-checks is_admin() on every write); everyone else
 *     gets the member toolset (own-rows-only, RLS-scoped).
 *  4. Run the manual tool-use loop and return { reply, actions }.
 *
 * The client posts the running message history as `messages`
 * (Anthropic.MessageParam[] with text content). We sanitize it to user/assistant
 * text turns so a client can never inject tool_result blocks or other roles.
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

const MEMBER_SYSTEM = `You are the ABCAC member portal assistant. You help THIS member with their own certification account. Before performing any action that writes data or submits a request, briefly confirm the details with the user and wait for them to say yes. Never reveal or act on anyone else's data. Be concise and friendly. You can also tell them which page to visit.`;

const ADMIN_SYSTEM = `You are the ABCAC admin assistant for ABCAC staff. You can look up any member and take administrative actions. Before approving, rejecting, issuing a credential, deciding a verification, or creating an invoice, confirm the specifics with the admin first. Summarize what you did after each action.`;

export async function POST(req: Request): Promise<Response> {
  // 1. Graceful degradation when the key is absent.
  if (!isAssistantConfigured()) {
    return Response.json({ error: "assistant_not_configured" }, { status: 503 });
  }

  // 2. Authenticate via the cookie session.
  const sb = createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const messages = sanitizeMessages((body as { messages?: unknown })?.messages);
  if (messages.length === 0) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  // 3. Resolve role + the requested surface (member vs admin).
  const { data: profile } = await sb
    .from("profiles")
    .select("portal_role,first_name,last_name,cert_status,account_status")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.portal_role === "admin";
  const requested = (body as { surface?: unknown })?.surface;
  const useAdmin = isAdmin && requested === "admin";

  let system: string;
  let tools: AssistantTool[];
  let executors: Record<string, ToolExecutor>;

  if (useAdmin) {
    const admin = createSupabaseAdminClient();
    system = ADMIN_SYSTEM;
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
      `${MEMBER_SYSTEM}\n\nContext: You are speaking with ${name}` +
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
