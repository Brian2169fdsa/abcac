// ABCAC — member-portal activity helpers.
//
// Pure glue between the Supabase fetch results and the shared activity feed
// builder (src/lib/activity.ts). Keeping the source-assembly + ?type= validation
// here lets the thin server page stay untested while the mapping logic is covered.

import type { ActivitySources, ActivityType } from "@/lib/activity";

type Row = Record<string, unknown>;

/** Raw per-table fetch results for the signed-in member (each may be null). */
export interface RawAccountActivity {
  applications?: Row[] | null;
  certifications?: Row[] | null;
  payments?: Row[] | null;
  invoices?: Row[] | null;
  ceuRecords?: Row[] | null;
  documents?: Row[] | null;
  documentRequests?: Row[] | null;
  messages?: Row[] | null;
  nameChangeRequests?: Row[] | null;
  reciprocityRequests?: Row[] | null;
}

/** Normalize the raw fetch results (null/undefined → []) into ActivitySources. */
export function assembleSources(raw: RawAccountActivity): ActivitySources {
  return {
    applications: raw.applications ?? [],
    certifications: raw.certifications ?? [],
    payments: raw.payments ?? [],
    invoices: raw.invoices ?? [],
    ceuRecords: raw.ceuRecords ?? [],
    documents: raw.documents ?? [],
    documentRequests: raw.documentRequests ?? [],
    messages: raw.messages ?? [],
    nameChangeRequests: raw.nameChangeRequests ?? [],
    reciprocityRequests: raw.reciprocityRequests ?? [],
  };
}

/** The activity types a member can filter the timeline by via ?type=. */
export const ACTIVITY_TYPES: readonly ActivityType[] = [
  "application",
  "certification",
  "payment",
  "invoice",
  "ceu",
  "document",
  "document_request",
  "message",
  "name_change",
  "reciprocity",
] as const;

/** Validate a raw ?type= query value; returns the type or null when invalid. */
export function parseActivityType(value: string | string[] | undefined): ActivityType | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return null;
  return (ACTIVITY_TYPES as readonly string[]).includes(v) ? (v as ActivityType) : null;
}
