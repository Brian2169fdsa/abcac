import { describe, it, expect } from "vitest";
import { getWebsiteTools, getWebsiteExecutors } from "@/lib/assistant/website-tools";

describe("website assistant tools (Level 1, public)", () => {
  const tools = getWebsiteTools();
  const exec = getWebsiteExecutors();

  it("exposes only read-only, non-personal tools", () => {
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["list_certifications", "lookup_fees", "suggest_page"]);
  });

  it("never defines a tool that accepts a member/user id", () => {
    for (const t of tools) {
      const props = (t.input_schema as { properties?: Record<string, unknown> }).properties ?? {};
      const keys = Object.keys(props).map((k) => k.toLowerCase());
      expect(keys.some((k) => k.includes("member") || k.includes("user_id") || k.includes("uid"))).toBe(
        false,
      );
    }
  });

  it("list_certifications returns catalog items with fees", async () => {
    const out = await exec.list_certifications({});
    expect(out).toContain("$");
    expect(out.split("\n").length).toBeGreaterThan(1);
  });

  it("list_certifications filters by category", async () => {
    const out = await exec.list_certifications({ category: "renewal" });
    expect(out.toLowerCase()).toContain("renewal");
  });

  it("lookup_fees finds a matching product", async () => {
    const out = await exec.lookup_fees({ query: "initial certification" });
    expect(out.toLowerCase()).toContain("initial certification");
    expect(out).toContain("$");
  });

  it("lookup_fees refuses to guess when nothing matches", async () => {
    const out = await exec.lookup_fees({ query: "zzz-nonexistent-thing" });
    expect(out.toLowerCase()).toContain("do not guess");
  });

  it("suggest_page returns known public routes for a topic", async () => {
    const out = await exec.suggest_page({ topic: "how do I apply" });
    expect(out).toMatch(/\/(initial-certification|choose-your-cert-path|signup)/);
  });

  it("suggest_page only ever returns paths under the public allowlist", async () => {
    const out = await exec.suggest_page({ topic: "" });
    for (const line of out.split("\n")) {
      expect(line.startsWith("/")).toBe(true);
      // No portal/admin/account routes ever leak from the public guide.
      expect(line).not.toMatch(/\/(account|admin|portal)\b/);
    }
  });
});
