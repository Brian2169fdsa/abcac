import { describe, it, expect } from "vitest";
import {
  assembleSources,
  parseActivityType,
  ACTIVITY_TYPES,
} from "@/lib/account-activity";
import { buildActivityFeed } from "@/lib/activity";

describe("assembleSources", () => {
  it("normalizes null/undefined fetch results to empty arrays for every key", () => {
    const sources = assembleSources({});
    expect(Object.keys(sources).sort()).toEqual(
      [
        "applications",
        "certifications",
        "payments",
        "invoices",
        "ceuRecords",
        "documents",
        "documentRequests",
        "messages",
        "nameChangeRequests",
        "reciprocityRequests",
      ].sort(),
    );
    for (const v of Object.values(sources)) expect(v).toEqual([]);
  });

  it("passes rows through and feeds buildActivityFeed", () => {
    const sources = assembleSources({
      payments: [{ id: "p1", amount_cents: 5000, status: "paid", created_at: "2026-06-01T00:00:00Z" }],
      messages: null,
    });
    expect(sources.payments).toHaveLength(1);
    expect(sources.messages).toEqual([]);
    const feed = buildActivityFeed(sources);
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe("payment");
    expect(feed[0].link).toBe("/account/invoices");
  });

  it("maps the snake_case fetch keys to the camelCase source keys", () => {
    const sources = assembleSources({
      ceuRecords: [{ id: "e1", course_name: "Ethics", hours: 3, completion_date: "2026-03-01" }],
      documentRequests: [{ id: "dr1", document_type: "Training", created_at: "2026-06-08T00:00:00Z" }],
      nameChangeRequests: [{ id: "n1", new_name: "Jane", submitted_at: "2026-06-02T00:00:00Z" }],
      reciprocityRequests: [{ id: "r1", destination: "NV", submitted_at: "2026-06-03T00:00:00Z" }],
    });
    const types = buildActivityFeed(sources).map((e) => e.type).sort();
    expect(types).toEqual(["ceu", "document_request", "name_change", "reciprocity"].sort());
  });
});

describe("parseActivityType", () => {
  it("returns the type for each known activity type", () => {
    for (const t of ACTIVITY_TYPES) expect(parseActivityType(t)).toBe(t);
  });

  it("returns null for unknown / empty / undefined values", () => {
    expect(parseActivityType("bogus")).toBeNull();
    expect(parseActivityType("")).toBeNull();
    expect(parseActivityType(undefined)).toBeNull();
  });

  it("handles array query values by taking the first entry", () => {
    expect(parseActivityType(["payment", "ceu"])).toBe("payment");
    expect(parseActivityType(["nope"])).toBeNull();
  });

  it("covers exactly the ten known types", () => {
    expect(ACTIVITY_TYPES).toHaveLength(10);
  });
});

describe("limit behavior used by the home card", () => {
  it("caps the feed to the requested limit, newest-first", () => {
    const sources = assembleSources({
      payments: [
        { id: "p1", amount_cents: 100, created_at: "2026-01-01T00:00:00Z" },
        { id: "p2", amount_cents: 200, created_at: "2026-02-01T00:00:00Z" },
        { id: "p3", amount_cents: 300, created_at: "2026-03-01T00:00:00Z" },
      ],
    });
    const feed = buildActivityFeed(sources, { limit: 2 });
    expect(feed).toHaveLength(2);
    expect(feed[0].id).toBe("payment:p3");
  });
});
