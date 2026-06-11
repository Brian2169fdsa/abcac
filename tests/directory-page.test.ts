import { describe, it, expect } from "vitest";
import {
  parseType,
  parsePage,
  parseQuery,
  parseParams,
  pageOffset,
  totalPages,
  formatShowing,
  buildQuery,
  PAGE_SIZE,
} from "@/app/(site)/directory/params";

describe("parseType", () => {
  it("accepts a known credential type", () => {
    expect(parseType("CADC")).toBe("CADC");
  });

  it("is case-insensitive and normalizes to the canonical value", () => {
    expect(parseType("cadc")).toBe("CADC");
  });

  it("returns 'all' for unknown or empty values", () => {
    expect(parseType("bogus")).toBe("all");
    expect(parseType("")).toBe("all");
    expect(parseType(undefined)).toBe("all");
  });

  it("takes the first element of an array param", () => {
    expect(parseType(["CCS", "CAC"])).toBe("CCS");
  });
});

describe("parsePage", () => {
  it("parses a valid 1-based page", () => {
    expect(parsePage("3")).toBe(3);
  });

  it("clamps below 1 and junk to 1", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage(undefined)).toBe(1);
  });
});

describe("parseQuery", () => {
  it("trims whitespace", () => {
    expect(parseQuery("  Jane Doe  ")).toBe("Jane Doe");
  });

  it("returns empty string when missing", () => {
    expect(parseQuery(undefined)).toBe("");
  });
});

describe("parseParams", () => {
  it("parses all three params together", () => {
    expect(parseParams({ q: " Smith ", type: "ccjp", page: "2" })).toEqual({
      q: "Smith",
      type: "CCJP",
      page: 2,
    });
  });

  it("falls back to defaults on empty input", () => {
    expect(parseParams({})).toEqual({ q: "", type: "all", page: 1 });
  });
});

describe("pageOffset", () => {
  it("page 1 → offset 0", () => {
    expect(pageOffset(1)).toBe(0);
  });

  it("page 3 with default page size", () => {
    expect(pageOffset(3)).toBe(2 * PAGE_SIZE);
  });

  it("clamps sub-1 pages to offset 0", () => {
    expect(pageOffset(0)).toBe(0);
  });
});

describe("totalPages", () => {
  it("rounds up partial pages", () => {
    expect(totalPages(25)).toBe(2);
    expect(totalPages(48)).toBe(2);
    expect(totalPages(49)).toBe(3);
  });

  it("returns at least 1 for empty results", () => {
    expect(totalPages(0)).toBe(1);
  });
});

describe("formatShowing", () => {
  it("formats a mid-range page", () => {
    // page 2, 24 rows, 130 total → 25–48
    expect(formatShowing(2, 24, 130)).toBe("Showing 25–48 of 130");
  });

  it("handles a partial final page", () => {
    expect(formatShowing(2, 6, 30)).toBe("Showing 25–30 of 30");
  });

  it("collapses to 0 of 0 when empty", () => {
    expect(formatShowing(1, 0, 0)).toBe("Showing 0 of 0");
  });
});

describe("buildQuery", () => {
  it("omits defaults (empty q, all, page 1)", () => {
    expect(buildQuery({ q: "", type: "all", page: 1 })).toBe("");
  });

  it("serializes non-default filters", () => {
    expect(buildQuery({ q: "Jane", type: "CADC", page: 3 })).toBe(
      "?q=Jane&type=CADC&page=3",
    );
  });

  it("applies overrides while preserving other filters", () => {
    const current = { q: "Jane", type: "CADC", page: 1 };
    expect(buildQuery(current, { page: 2 })).toBe("?q=Jane&type=CADC&page=2");
  });
});
