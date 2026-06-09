import { describe, it, expect } from "vitest";
import {
  buildDigest,
  escapeHtml,
  type AutomationRunRow,
} from "@/lib/automation/digest";

const SINCE = "2026-06-08T13:00:00.000Z";

function run(overrides: Partial<AutomationRunRow>): AutomationRunRow {
  return {
    created_at: "2026-06-09T01:00:00.000Z",
    workflow: "renewal",
    status: "auto_executed",
    confidence: 0.9,
    summary: "Renewed membership",
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      "&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;",
    );
  });

  it("renders null/undefined as empty string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("buildDigest", () => {
  it("groups counts by status and workflow", () => {
    const runs: AutomationRunRow[] = [
      run({ status: "auto_executed", workflow: "renewal" }),
      run({ status: "auto_executed", workflow: "renewal" }),
      run({ status: "escalated", workflow: "ceu" }),
      run({ status: "pending_approval", workflow: "ceu" }),
      run({ status: "failed", workflow: "billing" }),
    ];

    const digest = buildDigest(runs, SINCE);

    expect(digest.counts.total).toBe(5);
    expect(digest.counts.byStatus).toEqual({
      auto_executed: 2,
      escalated: 1,
      pending_approval: 1,
      failed: 1,
    });
    expect(digest.counts.byWorkflow).toEqual({
      renewal: 2,
      ceu: 2,
      billing: 1,
    });
  });

  it("buckets unknown statuses into 'other'", () => {
    const runs: AutomationRunRow[] = [
      run({ status: "skipped_disabled" }),
      run({ status: null }),
    ];
    const digest = buildDigest(runs, SINCE);
    expect(digest.counts.byStatus.other).toBe(2);
  });

  it("includes workflow, confidence and summary for auto_executed rows", () => {
    const runs: AutomationRunRow[] = [
      run({
        status: "auto_executed",
        workflow: "renewal",
        confidence: 0.87,
        summary: "Auto-renewed",
      }),
    ];
    const digest = buildDigest(runs, SINCE);
    expect(digest.html).toContain("renewal");
    expect(digest.html).toContain("87%");
    expect(digest.html).toContain("Auto-renewed");
  });

  it("includes failed rows in the failed section", () => {
    const runs: AutomationRunRow[] = [
      run({ status: "failed", workflow: "billing", summary: "Card declined" }),
    ];
    const digest = buildDigest(runs, SINCE);
    expect(digest.html).toContain("Card declined");
    expect(digest.html).toContain("Failed (1)");
  });

  it("HTML-escapes untrusted summary and workflow content", () => {
    const runs: AutomationRunRow[] = [
      run({
        status: "auto_executed",
        workflow: "<script>",
        summary: `<img src=x onerror="alert(1)">`,
      }),
    ];
    const digest = buildDigest(runs, SINCE);
    expect(digest.html).not.toContain("<script>");
    expect(digest.html).toContain("&lt;script&gt;");
    expect(digest.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("renders missing confidence as a dash", () => {
    const runs: AutomationRunRow[] = [
      run({ status: "auto_executed", confidence: null }),
    ];
    const digest = buildDigest(runs, SINCE);
    expect(digest.html).toContain("—");
  });

  it("handles the empty case without throwing", () => {
    const digest = buildDigest([], SINCE);
    expect(digest.counts.total).toBe(0);
    expect(digest.counts.byStatus).toEqual({});
    expect(digest.counts.byWorkflow).toEqual({});
    expect(digest.subject).toContain("0 runs");
    expect(digest.html).toContain("None");
  });

  it("uses singular wording for a single run", () => {
    const digest = buildDigest([run({})], SINCE);
    expect(digest.subject).toContain("1 run in");
  });
});
