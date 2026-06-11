// ABCAC — unified member activity timeline.
//
// Normalizes the many per-member tables (applications, certifications, payments,
// invoices, CEUs, documents, document requests, messages, name-change /
// reciprocity requests) into ONE chronological feed. Pure: callers fetch the
// rows (the admin member-detail page and the member portal already do) and pass
// them in; this merges, labels, links, and sorts. No new queries, no new tables.

export type ActivityType =
  | "application"
  | "certification"
  | "payment"
  | "invoice"
  | "ceu"
  | "document"
  | "document_request"
  | "message"
  | "name_change"
  | "reciprocity";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail: string | null;
  timestamp: string | null; // ISO
  /** Member-portal destination for this event (used on the member timeline). */
  link: string | null;
}

type Row = Record<string, unknown>;

export interface ActivitySources {
  applications?: Row[];
  certifications?: Row[];
  payments?: Row[];
  invoices?: Row[];
  ceuRecords?: Row[];
  documents?: Row[];
  documentRequests?: Row[];
  messages?: Row[];
  nameChangeRequests?: Row[];
  reciprocityRequests?: Row[];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const titleCase = (s: string): string =>
  s.split(/[_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

/** First non-empty timestamp among the given candidate fields. */
function pickTs(row: Row, fields: string[]): string | null {
  for (const f of fields) {
    const v = str(row[f]);
    if (v) return v;
  }
  return null;
}

function money(cents: unknown): string {
  const c = num(cents);
  return c == null ? "" : `$${(c / 100).toLocaleString("en-US")}`;
}

function idOf(row: Row, fallback: string): string {
  return str(row.id) ?? fallback;
}

/** Build the merged, newest-first activity feed from whatever sources exist. */
export function buildActivityFeed(sources: ActivitySources, opts: { limit?: number } = {}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const a of sources.applications ?? []) {
    const type = str(a.app_type);
    events.push({
      id: `application:${idOf(a, String(events.length))}`,
      type: "application",
      title: `Application${type ? ` — ${titleCase(type)}` : ""}`,
      detail: str(a.status) ? `Status: ${titleCase(str(a.status)!)}` : null,
      timestamp: pickTs(a, ["submitted_at", "reviewed_at", "created_at"]),
      link: "/account/applications",
    });
  }

  for (const c of sources.certifications ?? []) {
    const t = str(c.cert_type) ?? "Certification";
    const numb = str(c.cert_number);
    events.push({
      id: `certification:${idOf(c, String(events.length))}`,
      type: "certification",
      title: `Certification issued — ${t}`,
      detail: numb ? `#${numb}` : null,
      timestamp: pickTs(c, ["issued_date", "created_at"]),
      link: "/account/certifications",
    });
  }

  for (const p of sources.payments ?? []) {
    const amt = money(p.amount_cents);
    events.push({
      id: `payment:${idOf(p, String(events.length))}`,
      type: "payment",
      title: `Payment${amt ? ` — ${amt}` : ""}`,
      detail: [str(p.product_name), str(p.status) ? titleCase(str(p.status)!) : null].filter(Boolean).join(" · ") || null,
      timestamp: pickTs(p, ["created_at"]),
      link: "/account/invoices",
    });
  }

  for (const inv of sources.invoices ?? []) {
    const amt = money(inv.amount_cents);
    const number = str(inv.invoice_number);
    events.push({
      id: `invoice:${idOf(inv, String(events.length))}`,
      type: "invoice",
      title: `Invoice${number ? ` ${number}` : ""}${amt ? ` — ${amt}` : ""}`,
      detail: [str(inv.description), str(inv.status) ? titleCase(str(inv.status)!) : null].filter(Boolean).join(" · ") || null,
      timestamp: pickTs(inv, ["created_at", "paid_at"]),
      link: "/account/invoices",
    });
  }

  for (const r of sources.ceuRecords ?? []) {
    const hrs = num(r.hours);
    const name = str(r.course_name) ?? str(r.title) ?? str(r.category) ?? "CEU";
    events.push({
      id: `ceu:${idOf(r, String(events.length))}`,
      type: "ceu",
      title: `CEU logged — ${name}`,
      detail: [hrs != null ? `${hrs} hrs` : null, str(r.status) ? titleCase(str(r.status)!) : null].filter(Boolean).join(" · ") || null,
      timestamp: pickTs(r, ["completion_date", "created_at", "reviewed_at"]),
      link: "/account/ceus",
    });
  }

  for (const d of sources.documents ?? []) {
    events.push({
      id: `document:${idOf(d, String(events.length))}`,
      type: "document",
      title: `Document uploaded — ${str(d.document_type) ?? "file"}`,
      detail: str(d.status) ? `Status: ${titleCase(str(d.status)!)}` : null,
      timestamp: pickTs(d, ["uploaded_at", "created_at"]),
      link: "/account/documents",
    });
  }

  for (const dr of sources.documentRequests ?? []) {
    events.push({
      id: `document_request:${idOf(dr, String(events.length))}`,
      type: "document_request",
      title: `Document requested — ${str(dr.document_type) ?? "document"}`,
      detail: str(dr.note),
      timestamp: pickTs(dr, ["created_at"]),
      link: "/account/documents",
    });
  }

  for (const m of sources.messages ?? []) {
    events.push({
      id: `message:${idOf(m, String(events.length))}`,
      type: "message",
      title: `Message — ${str(m.subject) ?? "(no subject)"}`,
      detail: str(m.from_name),
      timestamp: pickTs(m, ["created_at"]),
      link: "/account/messages",
    });
  }

  for (const nc of sources.nameChangeRequests ?? []) {
    events.push({
      id: `name_change:${idOf(nc, String(events.length))}`,
      type: "name_change",
      title: "Name change request",
      detail: [str(nc.new_name) ? `→ ${str(nc.new_name)}` : null, str(nc.status) ? titleCase(str(nc.status)!) : null].filter(Boolean).join(" · ") || null,
      timestamp: pickTs(nc, ["submitted_at", "reviewed_at"]),
      link: "/account/requests",
    });
  }

  for (const rc of sources.reciprocityRequests ?? []) {
    events.push({
      id: `reciprocity:${idOf(rc, String(events.length))}`,
      type: "reciprocity",
      title: `Reciprocity request${str(rc.destination) ? ` — ${str(rc.destination)}` : ""}`,
      detail: str(rc.status) ? titleCase(str(rc.status)!) : null,
      timestamp: pickTs(rc, ["submitted_at", "reviewed_at"]),
      link: "/account/requests",
    });
  }

  events.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });

  return opts.limit ? events.slice(0, opts.limit) : events;
}

const TYPE_META: Record<ActivityType, { label: string; icon: string; tone: string }> = {
  application: { label: "Application", icon: "ClipboardList", tone: "bg-[#1F5FA8]/10 text-[#1F5FA8]" },
  certification: { label: "Certification", icon: "BadgeCheck", tone: "bg-brand/10 text-brand" },
  payment: { label: "Payment", icon: "CreditCard", tone: "bg-[#3E8E41]/10 text-[#3E8E41]" },
  invoice: { label: "Invoice", icon: "Receipt", tone: "bg-[#3E8E41]/10 text-[#3E8E41]" },
  ceu: { label: "CEU", icon: "GraduationCap", tone: "bg-[#6D28D9]/10 text-[#6D28D9]" },
  document: { label: "Document", icon: "FileText", tone: "bg-[#C8741F]/10 text-[#C8741F]" },
  document_request: { label: "Doc request", icon: "FileQuestion", tone: "bg-[#C8741F]/10 text-[#C8741F]" },
  message: { label: "Message", icon: "Mail", tone: "bg-[#6D28D9]/10 text-[#6D28D9]" },
  name_change: { label: "Name change", icon: "UserPen", tone: "bg-muted/15 text-muted" },
  reciprocity: { label: "Reciprocity", icon: "ArrowLeftRight", tone: "bg-muted/15 text-muted" },
};

export function activityMeta(type: ActivityType): { label: string; icon: string; tone: string } {
  return TYPE_META[type] ?? TYPE_META.message;
}
