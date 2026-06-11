// ABCAC — inbox_member: triage of inbound MEMBER messages (escalate-only).
//
// Members reach ABCAC through two channels:
//   1. The member portal compose form (src/components/messages-panel.tsx) —
//      rows in `messages` with sender_role='member' (pinned by the
//      guard_message_insert trigger, migration 014). Admins read these in
//      /admin/messaging and `is_read` flips when an admin opens the thread.
//   2. The PUBLIC contact form (/api/contact → `contact_messages`) — which a
//      logged-out member may also use. When the sender email matches a member
//      profile, the message is inbox_member territory, NOT inbox_faq.
//
// PRECEDENCE (coordinated with sweepInboxFaq in sweep.ts): a contact_messages
// row whose email matches a profiles row is ALWAYS routed to inbox_member —
// member match wins. sweepInboxFaq skips those rows entirely, and the
// inbox_faq rule re-checks the match as a defense-in-depth gate, so one
// message is only ever processed by one workflow.
//
// inbox_member is ESCALATE-ONLY by design: migration 031 seeds both its
// thresholds NULL, so tierFor() can never auto/propose — every run lands in
// the Needs-Attention queue. The VALUE of this workflow is the triage summary
// (who the member is, cert standing, what they're asking, suggested category,
// anomalies), not an automated reply. The rule is therefore always decisive.
//
// ADDING AN AGENT LATER is trivial: have inboxMemberRule return `null` for the
// cases the agent should weigh (instead of the always-decisive escalate at the
// bottom), register an agent in workflows/index.ts, and raise the thresholds
// in automation_config.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";

export const INBOX_MEMBER_RULE_VERSION = "inboxmem-1";

/** Lookback window shared by BOTH inbox sweeps (inbox_member and inbox_faq). */
export const INBOX_RECENT_DAYS = 7;

/** Max characters of the member's message quoted in the triage summary. */
export const TRIAGE_SNIPPET_CHARS = 200;

/**
 * Resolve a sender email to a member profile id (case-insensitive). Shared by
 * both inbox sweeps: a match routes the message to inbox_member, a miss leaves
 * it to inbox_faq.
 */
export async function profileIdForEmail(
  admin: SupabaseClient,
  email: string | null | undefined,
): Promise<string | null> {
  const e = (email ?? "").trim();
  if (!e) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", e)
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

// --- Category heuristic ---------------------------------------------------------

export type InboxCategory = "billing" | "renewal" | "ceu" | "general";

const CATEGORY_KEYWORDS: { category: InboxCategory; patterns: RegExp[] }[] = [
  {
    category: "renewal",
    patterns: [/\brenew/i, /\brecertif/i, /\bexpir/i, /\blapse/i],
  },
  {
    category: "ceu",
    patterns: [/\bceus?\b/i, /\bcontinuing education\b/i, /\bcontact hours?\b/i, /\bworkshop/i, /\bcredits?\b/i],
  },
  {
    category: "billing",
    patterns: [/\binvoice/i, /\bpayment/i, /\bpaid\b/i, /\bcharge/i, /\bbill/i, /\breceipt/i, /\bfee\b/i, /\bcard\b/i],
  },
];

/** Best-effort keyword categorization of an inbound member message. */
export function categorizeInboxMessage(text: string | null | undefined): InboxCategory {
  const t = text ?? "";
  for (const { category, patterns } of CATEGORY_KEYWORDS) {
    if (patterns.some((p) => p.test(t))) return category;
  }
  return "general";
}

// --- Row loading ----------------------------------------------------------------

interface ContactRow {
  id: string;
  name: string | null;
  email: string | null;
  message: string | null;
}

interface PortalMessageRow {
  id: string;
  member_id: string | null;
  subject: string | null;
  body: string | null;
  sender_role: string | null;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  account_status: string | null;
}

/** Member identity + cert standing, folded into the triage summary. */
async function loadMemberContext(
  admin: SupabaseClient,
  memberId: string,
): Promise<{ profile: ProfileRow | null; activeCerts: number; totalCerts: number }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id,first_name,last_name,email,account_status")
    .eq("id", memberId)
    .maybeSingle();
  const { data: certs } = await admin
    .from("certifications")
    .select("id,status")
    .eq("member_id", memberId);
  const list = (certs as { status: string | null }[] | null) ?? [];
  return {
    profile: profile as ProfileRow | null,
    activeCerts: list.filter((c) => (c.status ?? "") === "active").length,
    totalCerts: list.length,
  };
}

/** Build the decisive escalate carrying the triage summary. */
async function triageEscalate(
  admin: SupabaseClient,
  memberId: string,
  text: string,
  source: string,
): Promise<RuleResult> {
  const { profile, activeCerts, totalCerts } = await loadMemberContext(admin, memberId);
  const anomalies: string[] = [];
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || "(unknown name)";
  const status = profile?.account_status ?? "unknown";
  if (status !== "approved") anomalies.push("account_not_approved");

  const category = categorizeInboxMessage(text);
  const snippet = text.trim().replace(/\s+/g, " ").slice(0, TRIAGE_SNIPPET_CHARS);
  const certLine =
    totalCerts === 0 ? "no certifications on file" : `${activeCerts} active of ${totalCerts} certification(s)`;

  return {
    decisive: true,
    tier: "escalate",
    ruleVersion: INBOX_MEMBER_RULE_VERSION,
    anomalies,
    summary:
      `Member message (${source}) from ${name} — member ${memberId}, account ${status}, ${certLine}. ` +
      `Suggested category: ${category}. Asks: "${snippet}"`,
  };
}

// --- Rule -------------------------------------------------------------------------

/**
 * Triage rule for inbound member messages. Handles both entity types the
 * sweep dispatches:
 *   - entityType "message"          → a portal compose (`messages` row)
 *   - entityType "contact_message"  → a contact-form row from a member email
 * Always decisive escalate-only (thresholds are NULL anyway) with a useful
 * triage summary for the Needs-Attention queue.
 */
export async function inboxMemberRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  if (input.entityType === "message") {
    const { data } = await admin
      .from("messages")
      .select("id,member_id,subject,body,sender_role")
      .eq("id", input.entityId)
      .maybeSingle();
    const row = data as PortalMessageRow | null;
    // Only member-authored portal messages are triaged; admin/system messages
    // (announcements, reminders) are outbound and never enter this workflow.
    if (!row || row.sender_role !== "member" || !row.member_id) return null;
    const text = [row.subject, row.body].filter(Boolean).join(" — ");
    return triageEscalate(admin, row.member_id, text, "portal message");
  }

  if (input.entityType === "contact_message") {
    const { data } = await admin
      .from("contact_messages")
      .select("id,name,email,message")
      .eq("id", input.entityId)
      .maybeSingle();
    const row = data as ContactRow | null;
    if (!row) return null;
    // The sweep stamps memberId from the profile-email match; re-resolve when
    // dispatched ad hoc so the triage always has the member identity.
    const memberId = input.memberId ?? (await profileIdForEmail(admin, row.email));
    if (!memberId) {
      // Not actually a member — this row belongs to inbox_faq. Escalate with a
      // routing note rather than silently dropping it (defense in depth; the
      // sweeps' email partition normally prevents this).
      return {
        decisive: true,
        tier: "escalate",
        ruleVersion: INBOX_MEMBER_RULE_VERSION,
        anomalies: ["no_member_match"],
        summary: `Contact message ${row.id} has no matching member profile — belongs to inbox_faq routing.`,
      };
    }
    return triageEscalate(admin, memberId, row.message ?? "", "contact form");
  }

  return null;
}
