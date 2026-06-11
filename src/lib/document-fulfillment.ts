// ABCAC — close the document-request fulfillment loop.
//
// When a member uploads a document, any OPEN document_requests row for that
// member whose document_type matches the uploaded type should flip to
// 'fulfilled' (the same vocabulary the admin "Fulfill" button uses), so the
// request disappears from the member's open-requests banner AND from the
// admin's "Open Document Requests" table.
//
// This runs from the member's own session (the upload form is client-side and
// members may UPDATE their own document_requests under RLS — see migration 010
// policy "members_update_docreq"). It is best-effort: callers must never let a
// fulfillment failure break the upload itself.

import type { SupabaseClient } from "@supabase/supabase-js";

/** The status an open request is flipped to — matches fulfill-request-button.tsx. */
export const FULFILLED_STATUS = "fulfilled" as const;
/** The status an unfulfilled request carries — matches request-document.tsx. */
export const OPEN_STATUS = "open" as const;

/** Normalize a document_type for comparison: trimmed + lower-cased. */
export function normalizeDocType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Pure predicate: does an uploaded document of `uploadedType` satisfy an open
 * request of `requestType`? Equality on the normalized (trimmed, case-folded)
 * document_type. Empty/blank types never match (a blank upload type must not
 * sweep up unrelated requests).
 */
export function requestMatchesUpload(
  requestType: string | null | undefined,
  uploadedType: string | null | undefined,
): boolean {
  const req = normalizeDocType(requestType);
  const up = normalizeDocType(uploadedType);
  if (!req || !up) return false;
  return req === up;
}

interface OpenRequestRow {
  id: string;
  document_type: string | null;
}

export interface FulfillResult {
  /** ids of the requests that were flipped to fulfilled. */
  fulfilledIds: string[];
}

/**
 * Best-effort: find the member's OPEN document_requests whose document_type
 * matches `uploadedType` and flip them to fulfilled with fulfilled_at = now.
 *
 * - Scoped to `memberId` and status = OPEN, so already-fulfilled requests are
 *   never touched and never reopened.
 * - Matching is the normalized equality above; a non-matching upload is a no-op.
 * - Never throws: any error (query or update) resolves to an empty result so the
 *   surrounding upload flow always succeeds.
 */
export async function fulfillMatchingDocumentRequests(
  supabase: SupabaseClient,
  memberId: string,
  uploadedType: string | null | undefined,
): Promise<FulfillResult> {
  const empty: FulfillResult = { fulfilledIds: [] };
  try {
    if (!memberId || !normalizeDocType(uploadedType)) return empty;

    const { data, error } = await supabase
      .from("document_requests")
      .select("id,document_type")
      .eq("member_id", memberId)
      .eq("status", OPEN_STATUS);
    if (error || !data) return empty;

    const matches = (data as OpenRequestRow[]).filter((r) =>
      requestMatchesUpload(r.document_type, uploadedType),
    );
    if (matches.length === 0) return empty;

    const fulfilledAt = new Date().toISOString();
    const fulfilledIds: string[] = [];
    for (const row of matches) {
      const { error: upErr } = await supabase
        .from("document_requests")
        .update({ status: FULFILLED_STATUS, fulfilled_at: fulfilledAt })
        .eq("id", row.id)
        .eq("member_id", memberId)
        .eq("status", OPEN_STATUS);
      if (!upErr) fulfilledIds.push(row.id);
    }
    return { fulfilledIds };
  } catch {
    return empty;
  }
}
