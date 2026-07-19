import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizeCertNumber,
  selfReportedTokens,
  matchLegacyRecords,
  describeLegacyRecord,
  type LegacyMemberRecord,
} from "@/lib/legacy-members";

const record = (over: Partial<LegacyMemberRecord> = {}): LegacyMemberRecord => ({
  id: "rec-1",
  first_name: "Pat",
  last_name: "Jones",
  email: "pat@example.com",
  cert_type: "CADAC",
  cert_number: "CADAC-04471",
  expiration_date: "2027-03-01",
  claimed_by: null,
  ...over,
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Pat@Example.COM ")).toBe("pat@example.com");
  });
  it("handles null/undefined", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("normalizeCertNumber", () => {
  it("strips credential prefix, separators, and leading zeros", () => {
    expect(normalizeCertNumber("CADAC-04471")).toBe("4471");
    expect(normalizeCertNumber("cadac 04471")).toBe("4471");
    expect(normalizeCertNumber("CAC #0887")).toBe("887");
  });
  it("keeps plain numbers as-is", () => {
    expect(normalizeCertNumber("4471")).toBe("4471");
  });
  it("does not reduce an all-zero-prefixed number to empty", () => {
    expect(normalizeCertNumber("0007")).toBe("7");
  });
  it("handles null/empty", () => {
    expect(normalizeCertNumber(null)).toBe("");
    expect(normalizeCertNumber("  ")).toBe("");
  });
});

describe("selfReportedTokens", () => {
  it("splits on commas/semicolons/newlines and normalizes each token", () => {
    expect(selfReportedTokens("CADAC 4471, CAC-0887; 123")).toEqual(["4471", "887", "123"]);
  });
  it("drops tokens shorter than 2 chars", () => {
    expect(selfReportedTokens("7, 42")).toEqual(["42"]);
  });
  it("returns empty for null", () => {
    expect(selfReportedTokens(null)).toEqual([]);
  });
});

describe("matchLegacyRecords", () => {
  it("matches by email case-insensitively", () => {
    const matches = matchLegacyRecords([record()], {
      email: "PAT@example.com",
      submittedCertNumbers: null,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedBy).toBe("email");
  });

  it("matches by self-reported cert number when emails differ", () => {
    const matches = matchLegacyRecords([record({ email: "old-address@example.com" })], {
      email: "new-address@example.com",
      submittedCertNumbers: "CADAC 4471",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedBy).toBe("cert_number");
  });

  it("prefers the email match when both would hit", () => {
    const matches = matchLegacyRecords([record()], {
      email: "pat@example.com",
      submittedCertNumbers: "CADAC-04471",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].matchedBy).toBe("email");
  });

  it("returns no matches for an unrelated signup", () => {
    const matches = matchLegacyRecords([record()], {
      email: "stranger@example.com",
      submittedCertNumbers: "9999",
    });
    expect(matches).toHaveLength(0);
  });

  it("does not match everything when signup has no email and no numbers", () => {
    const matches = matchLegacyRecords([record()], { email: null, submittedCertNumbers: null });
    expect(matches).toHaveLength(0);
  });

  it("collects matches across multiple records", () => {
    const records = [
      record({ id: "a" }),
      record({ id: "b", email: "other@example.com", cert_number: "CAC-0887" }),
      record({ id: "c", email: "third@example.com", cert_number: "5555" }),
    ];
    const matches = matchLegacyRecords(records, {
      email: "pat@example.com",
      submittedCertNumbers: "887",
    });
    expect(matches.map((m) => m.record.id)).toEqual(["a", "b"]);
  });
});

describe("describeLegacyRecord", () => {
  it("summarizes name, credential, and expiration", () => {
    expect(describeLegacyRecord(record())).toBe("Pat Jones · CADAC #CADAC-04471 · expires 2027-03-01");
  });
  it("degrades gracefully with missing fields", () => {
    const summary = describeLegacyRecord(
      record({ first_name: null, last_name: null, cert_type: null, cert_number: null, expiration_date: null }),
    );
    expect(summary).toBe("Unnamed record · no expiration on file");
  });
});
