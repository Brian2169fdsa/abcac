// ABCAC — automation daily digest formatter (pure / unit-testable).
//
// Given the last-24h rows from `automation_runs`, build a superadmin email that
// summarizes everything the automation engine did unattended: counts by status
// and workflow, plus per-row detail for the rows that matter most for auditing
// (auto_executed and failed). No I/O here — see the cron route for the wiring.

/** A single row from the `automation_runs` table (only fields we read). */
export interface AutomationRunRow {
  created_at: string;
  workflow: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  member_id?: string | null;
  tier?: string | null;
  confidence?: number | null;
  status: string | null;
  summary?: string | null;
  anomaly_flags?: unknown;
  staged_action?: unknown;
}

/** The four statuses we surface explicitly; anything else lands in "other". */
const KNOWN_STATUSES = [
  "auto_executed",
  "escalated",
  "pending_approval",
  "failed",
] as const;

export interface DigestCounts {
  total: number;
  byStatus: Record<string, number>;
  byWorkflow: Record<string, number>;
}

export interface Digest {
  subject: string;
  html: string;
  counts: DigestCounts;
}

/** Escape a value for safe interpolation into HTML text/attributes. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatConfidence(confidence: number | null | undefined): string {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "—";
  return `${Math.round(confidence * 100)}%`;
}

function countBy(
  runs: AutomationRunRow[],
  key: (r: AutomationRunRow) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of runs) {
    const k = key(r);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function statusKey(run: AutomationRunRow): string {
  const s = run.status ?? "unknown";
  return (KNOWN_STATUSES as readonly string[]).includes(s) ? s : "other";
}

function detailRows(runs: AutomationRunRow[]): string {
  if (runs.length === 0) {
    return `<tr><td colspan="3" style="padding:6px 10px;color:#666;">None</td></tr>`;
  }
  return runs
    .map((r) => {
      const workflow = escapeHtml(r.workflow ?? "—");
      const confidence = escapeHtml(formatConfidence(r.confidence));
      const summary = escapeHtml(r.summary ?? "—");
      return `<tr>
  <td style="padding:6px 10px;border-top:1px solid #eee;">${workflow}</td>
  <td style="padding:6px 10px;border-top:1px solid #eee;">${confidence}</td>
  <td style="padding:6px 10px;border-top:1px solid #eee;">${summary}</td>
</tr>`;
    })
    .join("\n");
}

function countList(record: Record<string, number>): string {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return `<li style="color:#666;">None</li>`;
  }
  return entries
    .map(
      ([k, n]) =>
        `<li><strong>${escapeHtml(n)}</strong> ${escapeHtml(k)}</li>`,
    )
    .join("\n");
}

/**
 * Build the daily digest email from the last-24h automation runs.
 * Pure: no dates beyond what's passed in, no I/O.
 */
export function buildDigest(runs: AutomationRunRow[], sinceISO: string): Digest {
  const byStatus = countBy(runs, statusKey);
  const byWorkflow = countBy(runs, (r) => r.workflow ?? "unknown");
  const counts: DigestCounts = {
    total: runs.length,
    byStatus,
    byWorkflow,
  };

  const autoExecuted = runs.filter((r) => r.status === "auto_executed");
  const failed = runs.filter((r) => r.status === "failed");

  const subject = `ABCAC automation digest — ${runs.length} run${
    runs.length === 1 ? "" : "s"
  } in the last 24h`;

  const since = escapeHtml(sinceISO);

  const html = `<!doctype html>
<html>
<body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <h2 style="margin:0 0 4px;">ABCAC automation digest</h2>
  <p style="margin:0 0 16px;color:#666;">Unattended runs since ${since} (${escapeHtml(
    runs.length,
  )} total).</p>

  <h3 style="margin:16px 0 4px;">By status</h3>
  <ul style="margin:0 0 8px;padding-left:20px;">
${countList(byStatus)}
  </ul>

  <h3 style="margin:16px 0 4px;">By workflow</h3>
  <ul style="margin:0 0 8px;padding-left:20px;">
${countList(byWorkflow)}
  </ul>

  <h3 style="margin:16px 0 4px;">Auto-executed (${escapeHtml(autoExecuted.length)})</h3>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <thead>
      <tr style="text-align:left;">
        <th style="padding:6px 10px;">Workflow</th>
        <th style="padding:6px 10px;">Confidence</th>
        <th style="padding:6px 10px;">Summary</th>
      </tr>
    </thead>
    <tbody>
${detailRows(autoExecuted)}
    </tbody>
  </table>

  <h3 style="margin:16px 0 4px;">Failed (${escapeHtml(failed.length)})</h3>
  <table style="border-collapse:collapse;width:100%;font-size:14px;">
    <thead>
      <tr style="text-align:left;">
        <th style="padding:6px 10px;">Workflow</th>
        <th style="padding:6px 10px;">Confidence</th>
        <th style="padding:6px 10px;">Summary</th>
      </tr>
    </thead>
    <tbody>
${detailRows(failed)}
    </tbody>
  </table>
</body>
</html>`;

  return { subject, html, counts };
}
