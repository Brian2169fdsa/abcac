import { describe, it, expect } from "vitest";
import {
  firstParam,
  parseVerifyParams,
  decideMode,
  certResultKind,
  clampLimit,
  formatCredDate,
} from "@/lib/verify-lookup";
import type { PublicCredential } from "@/lib/directory";

const CRED: PublicCredential = {
  cert_number: "AZ-CADAC-50403",
  cert_type: "CADAC",
  status: "active",
  issued_date: "2024-05-19",
  expiration_date: "2028-05-19",
  full_name: "Linda Tran",
  last_name: "Tran",
};

describe("firstParam", () => {
  it("trims a single string and handles undefined", () => {
    expect(firstParam("  hi ")).toBe("hi");
    expect(firstParam(undefined)).toBe("");
  });
  it("takes the first element of an array", () => {
    expect(firstParam([" A ", "B"])).toBe("A");
    expect(firstParam([])).toBe("");
  });
});

describe("parseVerifyParams", () => {
  it("extracts and trims cert + name", () => {
    expect(parseVerifyParams({ cert: " AZ-1 ", name: " Linda " })).toEqual({
      cert: "AZ-1",
      name: "Linda",
    });
  });
  it("defaults missing params to empty strings", () => {
    expect(parseVerifyParams({})).toEqual({ cert: "", name: "" });
  });
});

describe("decideMode", () => {
  it("returns idle when nothing is searched", () => {
    expect(decideMode({ cert: "", name: "" })).toBe("idle");
  });
  it("prefers cert over name", () => {
    expect(decideMode({ cert: "AZ-1", name: "Linda" })).toBe("cert");
  });
  it("returns name when only a name is given", () => {
    expect(decideMode({ cert: "", name: "Linda" })).toBe("name");
  });
});

describe("certResultKind", () => {
  it("not-found when lookup is null (could be unknown OR opted out)", () => {
    expect(certResultKind(null, false)).toBe("not-found");
  });
  it("verified-active when found and valid", () => {
    expect(certResultKind(CRED, true)).toBe("verified-active");
  });
  it("verified-lapsed when found but not currently valid", () => {
    expect(certResultKind(CRED, false)).toBe("verified-lapsed");
  });
});

describe("clampLimit", () => {
  it("clamps into the 1..100 range", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(500)).toBe(100);
    expect(clampLimit(10)).toBe(10);
  });
  it("falls back for undefined / non-finite", () => {
    expect(clampLimit(undefined)).toBe(10);
    expect(clampLimit(Number.NaN)).toBe(10);
  });
});

describe("formatCredDate", () => {
  it("formats an ISO calendar date without TZ drift", () => {
    expect(formatCredDate("2028-05-19")).toBe("May 19, 2028");
  });
  it("returns an em dash for null/invalid", () => {
    expect(formatCredDate(null)).toBe("—");
    expect(formatCredDate("not-a-date")).toBe("—");
  });
});
