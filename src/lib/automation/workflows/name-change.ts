// ABCAC — name_change rule + MODEL-EVALUATED agent pass.
//
// Members file name_change_requests (status 'pending') with a reason and an
// optional supporting document. The deterministic rule gates the obvious dead
// ends (nothing to change, no supporting document → decisive escalate) and
// hands every plausible request to the agent.
//
// The agent evaluates PLAUSIBILITY FROM TEXT ONLY for now — current vs new name
// shape (surname change? complete identity swap?) plus the stated reason. The
// uploaded document is NOT visually verified yet (that's a later vision batch),
// so the eval's confidence is hard-capped at NAME_CHANGE_CONFIDENCE_CAP (0.85),
// below the workflow's 0.90 auto threshold (migration 031): a text-only eval
// can reach PROPOSE at most, never silent auto-apply.
//
// "apply" maps to the whitelisted `apply_name_change` executor, which marks the
// request 'completed' (the approve status used by the admin decideRequest flow)
// and writes the parsed name back to the member's profile.
//
// GRACEFUL DEGRADATION (same convention as vision.ts): without
// ANTHROPIC_API_KEY the agent returns null, so dispatch escalates the run with
// the "no_evaluator" flag instead of throwing.

import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_MODEL, isAssistantConfigured, getAnthropicClient } from "@/lib/assistant/anthropic";
import { extractJsonObject, clampConfidence } from "../vision";
import type { AgentEval, DispatchInput, RuleResult } from "../types";

export const NAME_CHANGE_RULE_VERSION = "namechg-1";

/** Bump when the agent prompt changes — it rides on `modelVersion`. */
export const NAME_CHANGE_PROMPT_VERSION = "namechg-agent-1";
export const NAME_CHANGE_MODEL_VERSION = `${ASSISTANT_MODEL}/${NAME_CHANGE_PROMPT_VERSION}`;

/**
 * Propose ceiling: the supporting document was not visually verified, so a
 * text-only plausibility eval may never clear the 0.90 auto threshold.
 */
export const NAME_CHANGE_CONFIDENCE_CAP = 0.85;

interface RequestRow {
  id: string;
  member_id: string | null;
  current_name: string | null;
  new_name: string | null;
  reason: string | null;
  doc_path: string | null;
  status: string | null;
}

async function loadPendingRequest(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RequestRow | null> {
  if (!input.entityId) return null;
  const { data } = await admin
    .from("name_change_requests")
    .select("id,member_id,current_name,new_name,reason,doc_path,status")
    .eq("id", input.entityId)
    .maybeSingle();
  const req = data as RequestRow | null;
  if (!req) return null;
  // Already decided ('completed'/'rejected') by a human or a prior run.
  if ((req.status ?? "") !== "pending") return null;
  return req;
}

/** Case/whitespace-insensitive comparison of two full names. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(a) === norm(b);
}

export async function nameChangeRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  const req = await loadPendingRequest(admin, input);
  if (!req) return null;

  const newName = (req.new_name ?? "").trim();
  if (!newName || sameName(newName, req.current_name ?? "")) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: NAME_CHANGE_RULE_VERSION,
      anomalies: ["nothing_to_change"],
      summary: "Requested name is empty or identical to the current name — nothing to change.",
    };
  }

  if (!req.doc_path?.trim()) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: NAME_CHANGE_RULE_VERSION,
      anomalies: ["no_supporting_document"],
      summary: "No supporting document uploaded — a human must request documentation.",
    };
  }

  // Plausible on its face — the agent weighs the text signals.
  return null;
}

// --- Agent evaluator -----------------------------------------------------------

/** Build the strict-JSON plausibility prompt from the request's text fields. */
export function buildNameChangePrompt(req: RequestRow): string {
  return [
    "You are screening a legal-name-change request from a certified counselor's",
    "member-portal account at a state certification board. A supporting document",
    "was uploaded but has NOT been verified yet — judge plausibility from the",
    "text alone.",
    "",
    "Request facts:",
    `  - current name on file: ${req.current_name ?? "(none)"}`,
    `  - requested new name: ${req.new_name ?? "(none)"}`,
    `  - stated reason: ${req.reason ?? "(none)"}`,
    "",
    "Consider how the names relate (e.g. a surname change after marriage/divorce",
    "is routine; a complete identity swap with no shared parts is suspicious) and",
    "whether the reason is consistent with the change.",
    "",
    "Respond with STRICT JSON only — no prose, no markdown fences — of the shape:",
    '{ "recommend": "apply" | "escalate", "confidence": <number 0..1>, "rationale": <string> }',
  ].join("\n");
}

export async function nameChangeAgent(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<AgentEval | null> {
  // No API key → no evaluator: dispatch records an escalated "no_evaluator" run.
  if (!isAssistantConfigured()) return null;

  const req = await loadPendingRequest(admin, input);
  if (!req) return null;

  let text: string;
  try {
    const client: Anthropic = getAnthropicClient();
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: buildNameChangePrompt(req) }],
    });
    text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch {
    return {
      confidence: 0,
      anomalies: ["model_error"],
      modelVersion: NAME_CHANGE_MODEL_VERSION,
      summary: "Model call failed — escalating to a human reviewer.",
    };
  }

  const raw = extractJsonObject(text);
  if (!raw) {
    return {
      confidence: 0,
      anomalies: ["parse_error"],
      modelVersion: NAME_CHANGE_MODEL_VERSION,
      summary: "Model returned unparseable output — escalating to a human reviewer.",
    };
  }

  const recommend = typeof raw.recommend === "string" ? raw.recommend : "escalate";
  // Cap below the 0.90 auto threshold — text-only eval can at most PROPOSE.
  const confidence = Math.min(clampConfidence(raw.confidence), NAME_CHANGE_CONFIDENCE_CAP);
  const rationale = typeof raw.rationale === "string" ? raw.rationale : "";

  if (recommend === "apply") {
    return {
      confidence,
      action: {
        handler: "apply_name_change",
        args: { id: req.id, memberId: req.member_id, expectStatus: "pending" },
      },
      modelVersion: NAME_CHANGE_MODEL_VERSION,
      summary: rationale || "Agent finds the name change plausible — proposing apply.",
    };
  }
  return {
    confidence,
    anomalies: recommend === "escalate" ? [] : ["unexpected_recommendation"],
    modelVersion: NAME_CHANGE_MODEL_VERSION,
    summary: rationale || "Agent recommends human review of the name change.",
  };
}
