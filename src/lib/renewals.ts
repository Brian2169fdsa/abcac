// ABCAC — renewal pipeline classification.
//
// The board's core credential-continuity + revenue cycle: an active cert nears
// expiration → a renewal invoice is generated → the member pays → the cert is
// extended; or it lapses. This pure module classifies each certification into a
// pipeline stage from the cert + the member's most recent renewal invoice, and
// summarizes the pipeline into KPIs. It mirrors the automation workflows that
// drive the cycle (invoice_generation, dunning, certificate_issuance) but is
// read-only reporting — the admin /admin/renewals page renders it.

export type RenewalStage =
  | "upcoming" // active, expiring within the window, no renewal invoice yet
  | "invoiced" // renewal invoice exists, unpaid
  | "paid_processing" // renewal invoice paid, cert not yet extended
  | "renewed" // renewal paid + cert extended past the window
  | "lapsed" // expired / past expiration, not renewed
  | "current"; // active, beyond the window — not in the actionable pipeline

/** Certs expiring within this many days enter the actionable pipeline. */
export const RENEWAL_WINDOW_DAYS = 90;
/** A paid renewal whose cert now expires beyond this is considered "renewed". */
export const RENEWED_HORIZON_DAYS = 180;

const DAY_MS = 86_400_000;

export interface CertInput {
  member_id: string | null;
  cert_type: string | null;
  cert_number: string | null;
  status: string | null;
  expiration_date: string | null;
}

export interface InvoiceInput {
  member_id: string | null;
  invoice_number: string | null;
  description: string | null;
  amount_cents: number | null;
  status: string | null; // 'unpaid' | 'paid' | 'refunded'
  created_at: string | null;
}

export interface ProfileInput {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface RenewalRow {
  memberId: string;
  memberName: string;
  email: string | null;
  certType: string | null;
  certNumber: string | null;
  expirationDate: string | null;
  daysToExpiry: number | null;
  stage: RenewalStage;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

export function daysToExpiry(expiration: string | null, now: Date): number | null {
  if (!expiration) return null;
  const t = Date.parse(expiration);
  if (Number.isNaN(t)) return null;
  return Math.round((t - now.getTime()) / DAY_MS);
}

const isRenewalInvoice = (inv: InvoiceInput): boolean =>
  (inv.description ?? "").toLowerCase().includes("renewal");

/** Classify one cert into a stage given the member's latest renewal invoice. */
export function classifyRenewal(
  cert: CertInput,
  renewalInvoice: InvoiceInput | null,
  now: Date = new Date(),
): RenewalStage {
  const days = daysToExpiry(cert.expiration_date, now);
  const expiredStatus = cert.status === "expired" || cert.status === "inactive";
  if (expiredStatus || (days != null && days < 0)) return "lapsed";

  if (cert.status !== "active") return "current";

  if (renewalInvoice) {
    if (renewalInvoice.status === "paid") {
      return days != null && days > RENEWED_HORIZON_DAYS ? "renewed" : "paid_processing";
    }
    if (renewalInvoice.status === "unpaid") return "invoiced";
  }

  if (days != null && days <= RENEWAL_WINDOW_DAYS) return "upcoming";
  return "current";
}

/** Most recent renewal invoice for a member (by created_at desc). */
function latestRenewalInvoice(invoices: InvoiceInput[]): InvoiceInput | null {
  let best: InvoiceInput | null = null;
  let bestT = -Infinity;
  for (const inv of invoices) {
    if (!isRenewalInvoice(inv)) continue;
    const t = inv.created_at ? Date.parse(inv.created_at) : 0;
    if (t >= bestT) {
      best = inv;
      bestT = t;
    }
  }
  return best;
}

const STAGE_ORDER: RenewalStage[] = ["lapsed", "upcoming", "invoiced", "paid_processing", "renewed"];

export interface RenewalPipeline {
  rows: RenewalRow[];
  byStage: Record<RenewalStage, RenewalRow[]>;
  counts: Record<RenewalStage, number>;
  /** Projected revenue from outstanding (unpaid) renewal invoices, in cents. */
  outstandingCents: number;
  /** Collected renewal revenue (paid renewal invoices in the window), in cents. */
  collectedCents: number;
}

/**
 * Build the renewal pipeline from certs + invoices + profiles. Only actionable
 * stages (everything except "current") are returned in `rows`/`byStage`, sorted
 * by urgency (soonest expiry first within a stage).
 */
export function buildRenewalPipeline(
  certs: CertInput[],
  invoices: InvoiceInput[],
  profiles: ProfileInput[],
  now: Date = new Date(),
): RenewalPipeline {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const invoicesByMember = new Map<string, InvoiceInput[]>();
  for (const inv of invoices) {
    const m = inv.member_id;
    if (!m) continue;
    const list = invoicesByMember.get(m) ?? [];
    list.push(inv);
    invoicesByMember.set(m, list);
  }

  const byStage = {
    upcoming: [], invoiced: [], paid_processing: [], renewed: [], lapsed: [], current: [],
  } as Record<RenewalStage, RenewalRow[]>;

  let outstandingCents = 0;
  let collectedCents = 0;

  for (const cert of certs) {
    if (!cert.member_id) continue;
    const renewalInvoice = latestRenewalInvoice(invoicesByMember.get(cert.member_id) ?? []);
    const stage = classifyRenewal(cert, renewalInvoice, now);
    const p = profileById.get(cert.member_id);
    const row: RenewalRow = {
      memberId: cert.member_id,
      memberName: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unknown member",
      email: p?.email ?? null,
      certType: cert.cert_type,
      certNumber: cert.cert_number,
      expirationDate: cert.expiration_date,
      daysToExpiry: daysToExpiry(cert.expiration_date, now),
      stage,
      invoiceNumber: renewalInvoice?.invoice_number ?? null,
      invoiceStatus: renewalInvoice?.status ?? null,
    };
    byStage[stage].push(row);
    if (renewalInvoice?.status === "unpaid") outstandingCents += renewalInvoice.amount_cents ?? 0;
    if (renewalInvoice?.status === "paid") collectedCents += renewalInvoice.amount_cents ?? 0;
  }

  const urgency = (r: RenewalRow) => (r.daysToExpiry == null ? Number.POSITIVE_INFINITY : r.daysToExpiry);
  for (const stage of STAGE_ORDER) byStage[stage].sort((a, b) => urgency(a) - urgency(b));

  const rows = STAGE_ORDER.flatMap((s) => byStage[s]);
  const counts = Object.fromEntries(
    (Object.keys(byStage) as RenewalStage[]).map((s) => [s, byStage[s].length]),
  ) as Record<RenewalStage, number>;

  return { rows, byStage, counts, outstandingCents, collectedCents };
}

export const STAGE_META: Record<RenewalStage, { label: string; tone: string }> = {
  upcoming: { label: "Upcoming", tone: "bg-[#1F5FA8]/10 text-[#1F5FA8]" },
  invoiced: { label: "Invoiced", tone: "bg-[#C8741F]/10 text-[#C8741F]" },
  paid_processing: { label: "Paid — processing", tone: "bg-[#6D28D9]/10 text-[#6D28D9]" },
  renewed: { label: "Renewed", tone: "bg-[#3E8E41]/10 text-[#3E8E41]" },
  lapsed: { label: "Lapsed", tone: "bg-accent/10 text-accent" },
  current: { label: "Current", tone: "bg-muted/15 text-muted" },
};
