export interface DueCert {
  cert_type?: string | null;
  cert_number?: string | null;
  status?: string | null;
  expiration_date?: string | null;
}
export interface DueDocRequest {
  document_type?: string | null;
  status?: string | null;
  created_at?: string | null;
}
export interface DueCeu {
  course_name?: string | null;
  status?: string | null;
  completion_date?: string | null;
}
export interface DueApplication {
  app_type?: string | null;
  cert_type?: string | null;
  status?: string | null;
  submitted_at?: string | null;
}

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
}
function cap(s: string | null | undefined) {
  return (s ?? "—").replace(/_/g, " ");
}
function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

type Tone = "overdue" | "soon" | "ok";

interface DueItem {
  key: string;
  label: string;
  detail: string;
  date: string | null | undefined;
  meta: string;
  tone: Tone;
}

function DueRow({ item }: { item: DueItem }) {
  const dot =
    item.tone === "overdue" ? "bg-brand" : item.tone === "soon" ? "bg-info" : "bg-success";
  const metaTone =
    item.tone === "overdue"
      ? "bg-brand/15 text-brand"
      : item.tone === "soon"
        ? "bg-accent/10 text-info"
        : "bg-success/15 text-success";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink">{item.label}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="capitalize">{item.detail}</span>
            <span>{fmt(item.date)}</span>
          </div>
        </div>
      </div>
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${metaTone}`}>
        {item.meta}
      </span>
    </li>
  );
}

/**
 * Cockpit panel: "what's due / upcoming" — cert expirations (days-until +
 * overdue highlight), pending document requests, pending CEU reviews and
 * pending applications. Overdue → brand (danger); upcoming → info/accent.
 */
export function MemberDuePanel({
  certs,
  docRequests,
  ceuRecords,
  applications,
}: {
  certs: DueCert[];
  docRequests: DueDocRequest[];
  ceuRecords: DueCeu[];
  applications: DueApplication[];
}) {
  const items: DueItem[] = [];

  // Cert expirations (active credentials only).
  certs
    .filter((c) => (c.status ?? "").toLowerCase() === "active")
    .forEach((c, i) => {
      const days = daysUntil(c.expiration_date);
      if (days === null) return;
      const overdue = days < 0;
      const soon = !overdue && days <= 90;
      items.push({
        key: `cert-${i}`,
        label: `${cap(c.cert_type)} renewal`,
        detail: c.cert_number ? `Cert ${c.cert_number}` : "Credential expiration",
        date: c.expiration_date,
        meta: overdue ? `Expired ${Math.abs(days)}d ago` : `${days}d left`,
        tone: overdue ? "overdue" : soon ? "soon" : "ok",
      });
    });

  // Pending document requests (open / pending / requested).
  docRequests
    .filter((r) => {
      const s = (r.status ?? "").toLowerCase();
      return s !== "fulfilled" && s !== "completed" && s !== "closed" && s !== "cancelled";
    })
    .forEach((r, i) => {
      const days = daysUntil(r.created_at);
      const ageDays = days === null ? null : -days; // created in the past → age
      items.push({
        key: `docreq-${i}`,
        label: `Document requested: ${cap(r.document_type)}`,
        detail: "Awaiting member upload",
        date: r.created_at,
        meta: ageDays != null && ageDays > 14 ? `Pending ${ageDays}d` : "Pending",
        tone: ageDays != null && ageDays > 14 ? "overdue" : "soon",
      });
    });

  // Pending CEU reviews (anything not yet approved/rejected).
  ceuRecords
    .filter((r) => {
      const s = (r.status ?? "").toLowerCase();
      return s !== "approved" && s !== "rejected";
    })
    .forEach((r, i) => {
      items.push({
        key: `ceu-${i}`,
        label: `CEU review: ${cap(r.course_name)}`,
        detail: "Awaiting admin review",
        date: r.completion_date,
        meta: "Pending review",
        tone: "soon",
      });
    });

  // Pending applications (submitted but not approved/rejected/completed).
  applications
    .filter((a) => {
      const s = (a.status ?? "").toLowerCase();
      return s !== "approved" && s !== "rejected" && s !== "completed";
    })
    .forEach((a, i) => {
      items.push({
        key: `app-${i}`,
        label: `Application: ${cap(a.app_type)}`,
        detail: a.cert_type ? `${cap(a.cert_type)} · ${cap(a.status)}` : cap(a.status),
        date: a.submitted_at,
        meta: "In progress",
        tone: "soon",
      });
    });

  // Overdue first, then soon, then ok; within a tone, soonest date first.
  const tonePriority: Record<Tone, number> = { overdue: 0, soon: 1, ok: 2 };
  items.sort((a, b) => {
    if (tonePriority[a.tone] !== tonePriority[b.tone]) return tonePriority[a.tone] - tonePriority[b.tone];
    const aT = a.date ? new Date(a.date).getTime() : Infinity;
    const bT = b.date ? new Date(b.date).getTime() : Infinity;
    return aT - bT;
  });

  const overdueCount = items.filter((i) => i.tone === "overdue").length;

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">What&apos;s due &amp; upcoming</h3>
        {overdueCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
            {overdueCount} overdue
          </span>
        ) : (
          <span className="text-xs text-muted">{items.length} item{items.length === 1 ? "" : "s"}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-bg px-4 py-6 text-center text-sm text-muted">
          Nothing due — this member is all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <DueRow key={item.key} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
