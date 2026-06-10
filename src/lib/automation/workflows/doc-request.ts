// ABCAC — doc_request deterministic rule (zero-model).
//
// "We still need X": when an application is in review and the member hasn't
// supplied the document that application type requires, auto-open a document
// request. The sweep does the cross-table gating (no matching document AND no
// open request already) and dispatches one per application; this rule
// re-validates the application state and the still-missing document, then stages
// the request. One request per application — idempotent via the sweep's run-dedup.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchInput, RuleResult } from "../types";

export const DOC_REQUEST_RULE_VERSION = "docreq-1";

/** The primary supporting document each application type requires. */
export const REQUIRED_DOC_BY_APP_TYPE: Record<string, string> = {
  initial_certification: "Education Verification",
  reciprocity: "Training Verification",
  renewal: "CEU Certificate of Completion",
};

const REVIEWABLE = new Set(["submitted", "under_review"]);

interface AppRow {
  id: string;
  member_id: string | null;
  app_type: string | null;
  status: string | null;
}

/** True when the member already has the required doc or an open request for it. */
export async function docAlreadyCovered(
  admin: SupabaseClient,
  memberId: string,
  documentType: string,
): Promise<boolean> {
  const { data: doc } = await admin
    .from("documents")
    .select("id")
    .eq("member_id", memberId)
    .eq("document_type", documentType)
    .limit(1)
    .maybeSingle();
  if (doc) return true;
  const { data: req } = await admin
    .from("document_requests")
    .select("id")
    .eq("member_id", memberId)
    .eq("document_type", documentType)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  return Boolean(req);
}

export async function docRequestRule(
  admin: SupabaseClient,
  input: DispatchInput,
): Promise<RuleResult | null> {
  if (!input.entityId) return null;

  const { data } = await admin
    .from("applications")
    .select("id,member_id,app_type,status")
    .eq("id", input.entityId)
    .maybeSingle();
  const app = data as AppRow | null;
  if (!app || !app.member_id || !app.app_type) return null;
  if (!REVIEWABLE.has(app.status ?? "")) return null;

  const need = REQUIRED_DOC_BY_APP_TYPE[app.app_type];
  if (!need) return null;
  if (await docAlreadyCovered(admin, app.member_id, need)) return null;

  return {
    decisive: true,
    tier: "auto",
    ruleVersion: DOC_REQUEST_RULE_VERSION,
    action: {
      handler: "request_document",
      args: {
        memberId: app.member_id,
        documentType: need,
        note: `Required to complete your ${app.app_type.replace(/_/g, " ")} application.`,
      },
    },
    summary: `Requested "${need}" for ${app.app_type.replace(/_/g, " ")} application.`,
  };
}
