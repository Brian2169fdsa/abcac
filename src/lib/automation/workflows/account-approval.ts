// ABCAC — account_approval rule + MODEL-EVALUATED agent pass.
//
// New registrations land in profiles with account_status='pending' (set by the
// signup trigger, then re-confirmed by the onboarding form which also stamps
// account_submitted_at). The deterministic rule does REJECT-side gating only:
//   • incomplete profile (missing name/email/DOB) → decisive escalate;
//   • self-reported cert number matches an ACTIVE certifications row → decisive
//     auto-approve (the board's own records corroborate the registrant);
//   • everything else → null, so the agent evaluator weighs the soft signals.
//
// The agent (Claude) reads the profile facts and returns strict JSON
// {recommend, confidence, rationale}. "approve" maps to the whitelisted
// `approve_account` executor; anything else carries NO action so dispatch
// escalates. The agent NEVER auto-rejects — rejection is always a human call.
//
// GRACEFUL DEGRADATION (same convention as vision.ts): without
// ANTHROPIC_API_KEY the agent returns null, so dispatch escalates the run with
// the "no_evaluator" flag instead of throwing.

import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_MODEL, isAssistantConfigured, getAnthropicClient } from "@/lib/assistant/anthropic";
import { extractJsonObject, clampConfidence } from "../vision";
import type { AgentEval, DispatchInput, RuleResult } from "../types";

export const ACCOUNT_APPROVAL_RULE_VERSION = "acct-1";

/** Bump when the agent prompt changes — it rides on `modelVersion`. */
export const ACCOUNT_APPROVAL_PROMPT_VERSION = "acct-agent-1";
export const ACCOUNT_APPROVAL_MODEL_VERSION = `${ASSISTANT_MODEL}/${ACCOUNT_APPROVAL_PROMPT_VERSION}`;

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  account_status: string | null;
  account_submitted_at: string | null;
  submitted_cert_numbers: string | null;
}

const PROFILE_COLS =
  "id,first_name,last_name,email,phone,date_of_birth,address_line1,city,state,zip_code," +
  "account_status,account_submitted_at,submitted_cert_numbers";

async function loadPendingProfile(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<ProfileRow | null> {
  if (!input.entityId) return null;
  const { data } = await admin
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", input.entityId)
    .maybeSingle();
  const p = data as ProfileRow | null;
  if (!p) return null;
  // Already decided by a human (approved/rejected) — nothing to do. A profile
  // without account_submitted_at hasn't finished onboarding yet, so it isn't
  // reviewable either (signup creates the row already in 'pending').
  if ((p.account_status ?? "") !== "pending") return null;
  if (!p.account_submitted_at) return null;
  return p;
}

/** Tokenize the free-text self-reported cert numbers (e.g. "CAC-12, 4471"). */
export function certNumberTokens(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function missingRequiredFields(p: ProfileRow): string[] {
  const missing: string[] = [];
  if (!p.first_name?.trim()) missing.push("first_name");
  if (!p.last_name?.trim()) missing.push("last_name");
  if (!p.email?.trim()) missing.push("email");
  if (!p.date_of_birth?.trim()) missing.push("date_of_birth");
  return missing;
}

/** ACTIVE certifications rows matching any self-reported number. */
async function matchedActiveCerts(
  admin: SupabaseClient,
  tokens: string[],
): Promise<{ cert_number: string | null; cert_type: string | null }[]> {
  if (tokens.length === 0) return [];
  const { data } = await admin
    .from("certifications")
    .select("id,cert_number,cert_type,status")
    .in("cert_number", tokens)
    .eq("status", "active");
  return (data as { cert_number: string | null; cert_type: string | null }[] | null) ?? [];
}

export async function accountApprovalRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  const p = await loadPendingProfile(admin, input);
  if (!p) return null;

  // Hard gate: an incomplete registration can never be approved automatically.
  const missing = missingRequiredFields(p);
  if (missing.length > 0) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: ACCOUNT_APPROVAL_RULE_VERSION,
      anomalies: ["incomplete_profile"],
      summary: `Registration incomplete (missing: ${missing.join(", ")}) — needs human follow-up.`,
    };
  }

  // Clean positive: a self-reported certification number that matches an ACTIVE
  // certification on file is the strongest possible corroboration — approve.
  const tokens = certNumberTokens(p.submitted_cert_numbers);
  const matches = await matchedActiveCerts(admin, tokens);
  if (matches.length > 0) {
    const label = matches
      .map((m) => `${m.cert_type ?? "certification"} #${m.cert_number ?? "?"}`)
      .join(", ");
    return {
      decisive: true,
      tier: "auto",
      ruleVersion: ACCOUNT_APPROVAL_RULE_VERSION,
      action: {
        handler: "approve_account",
        args: { memberId: p.id, expectStatus: "pending" },
      },
      summary: `Self-reported cert number matches active ${label} on file — auto-approved.`,
    };
  }

  // Complete but uncorroborated — let the agent weigh the soft signals.
  return null;
}

// --- Agent evaluator -----------------------------------------------------------

/** Build the strict-JSON evaluation prompt from profile facts (no free PII dump). */
export function buildAccountApprovalPrompt(
  p: ProfileRow,
  certInfo: { tokens: string[]; matched: number },
): string {
  const addressComplete = Boolean(p.address_line1?.trim() && p.city?.trim() && p.zip_code?.trim());
  const emailDomain = (p.email ?? "").split("@")[1] ?? "";
  return [
    "You are screening a new member-portal registration for a state counselor",
    "certification board. Decide whether the account looks like a legitimate",
    "registration that can be approved, or whether a staff member should review it.",
    "",
    "Registration facts:",
    `  - name: ${[p.first_name, p.last_name].filter(Boolean).join(" ") || "(none)"}`,
    `  - email domain: ${emailDomain || "(none)"}`,
    `  - date of birth provided: ${p.date_of_birth ? "yes" : "no"}`,
    `  - phone provided: ${p.phone ? "yes" : "no"}`,
    `  - address complete: ${addressComplete ? "yes" : "no"} (state: ${p.state ?? "(none)"})`,
    `  - self-reported certification numbers: ${certInfo.tokens.length ? certInfo.tokens.join(", ") : "(none)"}`,
    `  - of those, matched to an active certification on file: ${certInfo.matched}`,
    "",
    "Approving only grants portal access — it does not issue any credential.",
    "Never recommend rejecting; if anything looks off, recommend escalate.",
    "",
    "Respond with STRICT JSON only — no prose, no markdown fences — of the shape:",
    '{ "recommend": "approve" | "escalate", "confidence": <number 0..1>, "rationale": <string> }',
  ].join("\n");
}

export async function accountApprovalAgent(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<AgentEval | null> {
  // No API key → no evaluator: dispatch records an escalated "no_evaluator" run.
  if (!isAssistantConfigured()) return null;

  const p = await loadPendingProfile(admin, input);
  if (!p) return null;

  const tokens = certNumberTokens(p.submitted_cert_numbers);
  const matched = await matchedActiveCerts(admin, tokens);
  const prompt = buildAccountApprovalPrompt(p, { tokens, matched: matched.length });

  let text: string;
  try {
    const client: Anthropic = getAnthropicClient();
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });
    text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch {
    return {
      confidence: 0,
      anomalies: ["model_error"],
      modelVersion: ACCOUNT_APPROVAL_MODEL_VERSION,
      summary: "Model call failed — escalating to a human reviewer.",
    };
  }

  const raw = extractJsonObject(text);
  if (!raw) {
    return {
      confidence: 0,
      anomalies: ["parse_error"],
      modelVersion: ACCOUNT_APPROVAL_MODEL_VERSION,
      summary: "Model returned unparseable output — escalating to a human reviewer.",
    };
  }

  const recommend = typeof raw.recommend === "string" ? raw.recommend : "escalate";
  const confidence = clampConfidence(raw.confidence);
  const rationale = typeof raw.rationale === "string" ? raw.rationale : "";

  // NEVER auto-reject: "approve" is the only recommendation that carries an
  // action. Everything else (escalate, or anything unexpected like "reject")
  // ships no action, so dispatch escalates to a human.
  if (recommend === "approve") {
    return {
      confidence,
      action: { handler: "approve_account", args: { memberId: p.id, expectStatus: "pending" } },
      modelVersion: ACCOUNT_APPROVAL_MODEL_VERSION,
      summary: rationale || "Agent recommends approving the registration.",
    };
  }
  return {
    confidence,
    anomalies: recommend === "escalate" ? [] : ["unexpected_recommendation"],
    modelVersion: ACCOUNT_APPROVAL_MODEL_VERSION,
    summary: rationale || "Agent recommends human review of the registration.",
  };
}
