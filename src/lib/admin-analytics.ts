// ABCAC — admin analytics (real data for the AI Agent workspace + data chat).
//
// Replaces the demo mock dataset behind the AI Agent tab with live aggregations
// over certifications, payments, invoices, members, CEUs, and the open-work
// queues. Pure compute over fetched rows (board-scale volumes are small) + a
// thin fetch assembler, mirroring src/lib/automation/analytics.ts. Used by BOTH
// the Trends UI and the assistant's data tools, so the chat and the charts
// always agree.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminKpis {
  /** Certifications issued so far this calendar year. */
  certsYtd: number;
  /** Distinct credential types issued YTD. */
  certTypeCount: number;
  totalMembers: number;
  /** Members holding at least one active certification. */
  goodStanding: number;
  revenueMtdCents: number;
  revenueYtdCents: number;
  /** Total open items needing staff attention. */
  openItems: number;
}

export interface TrendPoint {
  /** "YYYY-MM" month key. */
  month: string;
  /** Human label, e.g. "Jun". */
  label: string;
  revenueCents: number;
  certsIssued: number;
  newMembers: number;
  ceusLogged: number;
}

export interface CertTypeSlice {
  certType: string;
  count: number;
}

export interface NeedsAttention {
  pendingApprovals: number;
  pendingCeus: number;
  openDocRequests: number;
  pendingApplications: number;
  openRequests: number;
  escalations: number;
  expiringSoon: number;
  total: number;
}

export interface AdminAnalytics {
  kpis: AdminKpis;
  trends: TrendPoint[];
  certsByType: CertTypeSlice[];
  needsAttention: NeedsAttention;
  generatedAt: string;
}

type Row = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

const monthKey = (iso: string): string => iso.slice(0, 7);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A paid money row (invoice or payment) contributes to revenue. */
const isPaid = (status: unknown): boolean => str(status) === "paid";

// ── pure compute ─────────────────────────────────────────────────────────────

export function computeKpis(args: {
  certs: Row[];
  invoices: Row[];
  payments: Row[];
  profiles: Row[];
  needsAttention: NeedsAttention;
  now?: Date;
}): AdminKpis {
  const now = args.now ?? new Date();
  const year = now.getUTCFullYear();
  const ym = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let certsYtd = 0;
  const ytdTypes = new Set<string>();
  for (const c of args.certs) {
    const issued = str(c.issued_date);
    if (issued && issued.slice(0, 4) === String(year)) {
      certsYtd += 1;
      const t = str(c.cert_type);
      if (t) ytdTypes.add(t);
    }
  }

  const activeMembers = new Set<string>();
  for (const c of args.certs) {
    if (str(c.status) === "active") {
      const m = str(c.member_id);
      if (m) activeMembers.add(m);
    }
  }

  // Revenue: paid invoices (by paid_at|created_at) + paid payments (by created_at).
  let revenueMtdCents = 0;
  let revenueYtdCents = 0;
  const addRevenue = (cents: number, when: string | null) => {
    if (!when) return;
    if (when.slice(0, 4) === String(year)) revenueYtdCents += cents;
    if (monthKey(when) === ym) revenueMtdCents += cents;
  };
  for (const inv of args.invoices) {
    if (!isPaid(inv.status)) continue;
    addRevenue(num(inv.amount_cents), str(inv.paid_at) ?? str(inv.created_at));
  }
  for (const p of args.payments) {
    if (!isPaid(p.status)) continue;
    addRevenue(num(p.amount_cents), str(p.created_at));
  }

  return {
    certsYtd,
    certTypeCount: ytdTypes.size,
    totalMembers: args.profiles.length,
    goodStanding: activeMembers.size,
    revenueMtdCents,
    revenueYtdCents,
    openItems: args.needsAttention.total,
  };
}

/** Monthly trend series for the trailing `months` (oldest → newest), zero-filled. */
export function computeTrends(
  args: { certs: Row[]; invoices: Row[]; payments: Row[]; profiles: Row[]; ceus: Row[] },
  months = 12,
  now: Date = new Date(),
): TrendPoint[] {
  const series: TrendPoint[] = [];
  const index = new Map<string, TrendPoint>();
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const point: TrendPoint = { month: key, label: MONTHS[d.getUTCMonth()], revenueCents: 0, certsIssued: 0, newMembers: 0, ceusLogged: 0 };
    series.push(point);
    index.set(key, point);
  }
  const bump = (when: string | null, apply: (p: TrendPoint) => void) => {
    if (!when) return;
    const p = index.get(monthKey(when));
    if (p) apply(p);
  };
  for (const inv of args.invoices) if (isPaid(inv.status)) bump(str(inv.paid_at) ?? str(inv.created_at), (p) => (p.revenueCents += num(inv.amount_cents)));
  for (const pay of args.payments) if (isPaid(pay.status)) bump(str(pay.created_at), (p) => (p.revenueCents += num(pay.amount_cents)));
  for (const c of args.certs) bump(str(c.issued_date), (p) => (p.certsIssued += 1));
  for (const m of args.profiles) bump(str(m.created_at), (p) => (p.newMembers += 1));
  for (const e of args.ceus) bump(str(e.completion_date) ?? str(e.created_at), (p) => (p.ceusLogged += 1));
  return series;
}

export function computeCertsByType(certs: Row[]): CertTypeSlice[] {
  const counts = new Map<string, number>();
  for (const c of certs) {
    if (str(c.status) !== "active") continue;
    const t = str(c.cert_type) ?? "Other";
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([certType, count]) => ({ certType, count }))
    .sort((a, b) => b.count - a.count);
}

// ── fetch + assemble ─────────────────────────────────────────────────────────

async function count(admin: SupabaseClient, table: string, build?: (q: any) => any): Promise<number> {
  try {
    let q = admin.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count: c } = await q;
    return c ?? 0;
  } catch {
    return 0;
  }
}

/** Tally the open-work queues that feed "needs attention". */
export async function getNeedsAttention(admin: SupabaseClient): Promise<NeedsAttention> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const in60 = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const [pendingApprovals, pendingCeus, openDocRequests, pendingApplications, ncReq, recReq, verReq, escalations, expiringSoon] =
    await Promise.all([
      count(admin, "profiles", (q) => q.eq("account_status", "pending").not("account_submitted_at", "is", null)),
      count(admin, "ceu_records", (q) => q.eq("status", "pending")),
      count(admin, "document_requests", (q) => q.eq("status", "open")),
      count(admin, "applications", (q) => q.in("status", ["submitted", "under_review"])),
      count(admin, "name_change_requests", (q) => q.eq("status", "pending")),
      count(admin, "reciprocity_requests", (q) => q.eq("status", "pending")),
      count(admin, "verification_requests", (q) => q.eq("status", "pending")),
      count(admin, "automation_runs", (q) => q.in("status", ["escalated", "pending_approval"])),
      count(admin, "certifications", (q) => q.eq("status", "active").gte("expiration_date", todayIso).lte("expiration_date", in60)),
    ]);
  const openRequests = ncReq + recReq + verReq;
  const total = pendingApprovals + pendingCeus + openDocRequests + pendingApplications + openRequests + escalations + expiringSoon;
  return { pendingApprovals, pendingCeus, openDocRequests, pendingApplications, openRequests, escalations, expiringSoon, total };
}

/** One-call real analytics for the AI Agent workspace + data tools. */
export async function getAdminAnalytics(admin: SupabaseClient, opts: { months?: number } = {}): Promise<AdminAnalytics> {
  const months = opts.months ?? 12;
  const [certsRes, invoicesRes, paymentsRes, profilesRes, ceusRes, needsAttention] = await Promise.all([
    admin.from("certifications").select("member_id,cert_type,status,issued_date,expiration_date").limit(20000),
    admin.from("invoices").select("amount_cents,status,created_at,paid_at").limit(20000),
    admin.from("payments").select("amount_cents,status,created_at").limit(20000),
    admin.from("profiles").select("id,created_at,cert_status,account_status").limit(20000),
    admin.from("ceu_records").select("status,created_at,completion_date").limit(20000),
    getNeedsAttention(admin),
  ]);
  const certs = (certsRes.data as Row[] | null) ?? [];
  const invoices = (invoicesRes.data as Row[] | null) ?? [];
  const payments = (paymentsRes.data as Row[] | null) ?? [];
  const profiles = (profilesRes.data as Row[] | null) ?? [];
  const ceus = (ceusRes.data as Row[] | null) ?? [];

  return {
    kpis: computeKpis({ certs, invoices, payments, profiles, needsAttention }),
    trends: computeTrends({ certs, invoices, payments, profiles, ceus }, months),
    certsByType: computeCertsByType(certs),
    needsAttention,
    generatedAt: new Date().toISOString(),
  };
}
