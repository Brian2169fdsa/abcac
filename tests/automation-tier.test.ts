import { describe, it, expect } from "vitest";
import { tierFor } from "@/lib/automation/tier";
import { isWhitelisted } from "@/lib/automation/registry";

const cfg = { auto: 0.95, propose: 0.8 };

describe("tierFor", () => {
  it("auto-executes at or above the auto threshold", () => {
    expect(tierFor(0.95, [], cfg)).toBe("auto");
    expect(tierFor(0.99, [], cfg)).toBe("auto");
  });

  it("proposes in the middle band", () => {
    expect(tierFor(0.8, [], cfg)).toBe("propose");
    expect(tierFor(0.94, [], cfg)).toBe("propose");
  });

  it("escalates below the propose threshold", () => {
    expect(tierFor(0.79, [], cfg)).toBe("escalate");
    expect(tierFor(0, [], cfg)).toBe("escalate");
  });

  it("ANY anomaly forces escalate, even at perfect confidence (anomaly trip)", () => {
    expect(tierFor(1, ["future_dated"], cfg)).toBe("escalate");
    expect(tierFor(0.99, ["duplicate_hash"], cfg)).toBe("escalate");
  });

  it("escalates when a threshold is null (not configured for that tier)", () => {
    expect(tierFor(0.99, [], { auto: null, propose: 0.8 })).toBe("propose");
    expect(tierFor(0.99, [], { auto: null, propose: null })).toBe("escalate");
  });
});

describe("registry whitelist", () => {
  it("recognizes the starter executors", () => {
    for (const h of ["approve_ceu", "reject_ceu", "request_document", "send_member_message", "set_application_status"]) {
      expect(isWhitelisted(h)).toBe(true);
    }
  });

  it("rejects unknown handlers (fail closed)", () => {
    expect(isWhitelisted("drop_table")).toBe(false);
    expect(isWhitelisted("arbitrary_write")).toBe(false);
  });
});
