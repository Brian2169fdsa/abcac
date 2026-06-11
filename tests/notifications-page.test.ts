import { describe, it, expect, vi, afterEach } from "vitest";
import {
  parseParams,
  matchesCategory,
  filterByCategory,
  categoryOptions,
  buildHref,
  timeAgo,
  iconFor,
  ICON_MAP,
} from "@/app/(portal)/account/notifications/helpers";
import { CATEGORY_META } from "@/lib/notifications";

afterEach(() => vi.useRealTimers());

describe("parseParams", () => {
  it("defaults to all/all on empty input", () => {
    expect(parseParams({})).toEqual({ filter: "all", category: "all" });
  });

  it("accepts valid filter and category", () => {
    expect(parseParams({ filter: "unread", category: "billing" })).toEqual({
      filter: "unread",
      category: "billing",
    });
  });

  it("clamps unknown filter and category to all", () => {
    expect(parseParams({ filter: "weird", category: "nope" })).toEqual({
      filter: "all",
      category: "all",
    });
  });

  it("accepts every real category", () => {
    for (const c of Object.keys(CATEGORY_META)) {
      expect(parseParams({ category: c }).category).toBe(c);
    }
  });
});

describe("category predicate + filter", () => {
  const rows = [
    { category: "billing" as const },
    { category: "documents" as const },
    { category: "billing" as const },
  ];

  it("matchesCategory is true for 'all' and for an exact match only", () => {
    expect(matchesCategory({ category: "billing" }, "all")).toBe(true);
    expect(matchesCategory({ category: "billing" }, "billing")).toBe(true);
    expect(matchesCategory({ category: "billing" }, "documents")).toBe(false);
  });

  it("filterByCategory returns all rows for 'all'", () => {
    expect(filterByCategory(rows, "all")).toHaveLength(3);
  });

  it("filterByCategory narrows to the chosen category", () => {
    expect(filterByCategory(rows, "billing")).toHaveLength(2);
    expect(filterByCategory(rows, "documents")).toHaveLength(1);
  });
});

describe("categoryOptions", () => {
  it("starts with All then lists each category label", () => {
    const opts = categoryOptions();
    expect(opts[0]).toEqual({ value: "all", label: "All" });
    expect(opts).toHaveLength(Object.keys(CATEGORY_META).length + 1);
    expect(opts).toContainEqual({ value: "billing", label: "Billing" });
  });
});

describe("buildHref", () => {
  it("omits default (all) params", () => {
    expect(buildHref({ filter: "all", category: "all" }, {})).toBe(
      "/account/notifications",
    );
  });

  it("sets a param while preserving the other", () => {
    expect(
      buildHref({ filter: "unread", category: "all" }, { category: "billing" }),
    ).toBe("/account/notifications?filter=unread&category=billing");
  });

  it("switching back to all drops that param", () => {
    expect(
      buildHref({ filter: "unread", category: "billing" }, { category: "all" }),
    ).toBe("/account/notifications?filter=unread");
  });
});

describe("timeAgo", () => {
  it("returns '' for null/invalid", () => {
    expect(timeAgo(null)).toBe("");
    expect(timeAgo("not-a-date")).toBe("");
  });

  it("formats minutes, hours, days, weeks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
    expect(timeAgo("2026-06-11T11:59:40Z")).toBe("just now");
    expect(timeAgo("2026-06-11T11:30:00Z")).toBe("30m ago");
    expect(timeAgo("2026-06-11T09:00:00Z")).toBe("3h ago");
    expect(timeAgo("2026-06-09T12:00:00Z")).toBe("2d ago");
    expect(timeAgo("2026-05-21T12:00:00Z")).toBe("3w ago");
  });
});

describe("iconFor / ICON_MAP", () => {
  it("maps every CATEGORY_META icon name to a component", () => {
    for (const meta of Object.values(CATEGORY_META)) {
      expect(ICON_MAP[meta.icon]).toBeDefined();
      expect(iconFor(meta.icon)).toBe(ICON_MAP[meta.icon]);
    }
  });

  it("falls back to Bell for an unknown icon name", () => {
    expect(iconFor("Nonexistent")).toBe(ICON_MAP.Bell);
  });
});
