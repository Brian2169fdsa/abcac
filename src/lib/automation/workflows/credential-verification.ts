// ABCAC — credential_verification deterministic rule (zero-model).
//
// A third party (employer/board) submits a verification request naming a
// counselor's certification number. This rule does a deterministic lookup and:
//   • AUTO-verifies only a CLEAN POSITIVE match — exactly one ACTIVE certification
//     whose unique cert_number equals the requested number → confirm "verified".
//   • ESCALATES everything else (no number, no active match, multiple matches).
//
// It NEVER auto-denies: a typo or a member not-yet-in-the-system must not produce
// an automated "not verified" that harms a real counselor. Negatives are a human
// decision. The actual write + requester email happen in the whitelisted
// `set_verification_result` executor (registry.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";

export const CREDENTIAL_VERIFICATION_RULE_VERSION = "credver-1";

interface RequestRow {
  id: string;
  status: string | null;
  subject_name: string | null;
  subject_cert_number: string | null;
}

interface CertRow {
  id: string;
  member_id: string | null;
  cert_type: string | null;
  cert_number: string | null;
  status: string | null;
}

export async function credentialVerificationRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data: reqData } = await admin
    .from("verification_requests")
    .select("id,status,subject_name,subject_cert_number")
    .eq("id", input.entityId)
    .maybeSingle();
  const req = reqData as RequestRow | null;
  if (!req) return null;
  // Already decided by a human or a prior run — nothing to do.
  if (req.status && req.status !== "pending") return null;

  const certNo = (req.subject_cert_number ?? "").trim();
  if (!certNo) {
    return {
      decisive: true,
      tier: "escalate",
      ruleVersion: CREDENTIAL_VERIFICATION_RULE_VERSION,
      anomalies: ["no_cert_number"],
      summary: "No certification number provided — needs a manual, name-based lookup.",
    };
  }

  const { data: certData } = await admin
    .from("certifications")
    .select("id,member_id,cert_type,cert_number,status")
    .eq("cert_number", certNo);
  const certs = (certData as CertRow[] | null) ?? [];
  const active = certs.filter((c) => (c.status ?? "").toLowerCase() === "active");

  if (active.length === 1) {
    const cert = active[0];
    return {
      decisive: true,
      tier: "auto",
      ruleVersion: CREDENTIAL_VERIFICATION_RULE_VERSION,
      action: {
        handler: "set_verification_result",
        args: { id: req.id, result: "verified", memberId: cert.member_id },
      },
      summary: `Active ${cert.cert_type ?? "certification"} matches cert # ${certNo} — auto-verified.`,
    };
  }

  // No active match, or ambiguous multiple — a human decides (never auto-deny).
  return {
    decisive: true,
    tier: "escalate",
    ruleVersion: CREDENTIAL_VERIFICATION_RULE_VERSION,
    anomalies: active.length === 0 ? ["no_active_match"] : ["multiple_active_matches"],
    summary:
      active.length === 0
        ? `No active certification found for # ${certNo} — needs manual review.`
        : `Multiple active certifications for # ${certNo} — needs manual review.`,
  };
}
