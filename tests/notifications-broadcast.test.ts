import { describe, it, expect } from "vitest";
import { makeClient, type ResultFor } from "./helpers/supabase-fake";
import { broadcastToMembers } from "@/lib/notifications-broadcast";

// The broadcast lib takes the (already admin-verified) service-role client as
// its first arg, so we drive it directly with the chainable fake. We key the
// resolver on table+op: profiles/select returns the member roster,
// notification_preferences/select returns the opted-OUT rows, and
// notifications/insert is where the fan-out lands.

const ADMIN = { id: "admin-1" };

/** Build a resolver from explicit per-(table,op) results. */
function resolver(map: Partial<Record<string, { data?: unknown; error?: unknown }>>): ResultFor {
  return (table, op) => map[`${table}:${op}`] ?? { data: null, error: null };
}

describe("broadcastToMembers — recipient resolution", () => {
  it("recipients = all members minus opted-out; no-prefs members included", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }, { id: "m2" }, { id: "m3" }] },
        // m2 explicitly opted out; m1 and m3 have no row (or true) → included.
        "notification_preferences:select": { data: [{ member_id: "m2" }] },
        "notifications:insert": { data: null, error: null },
      }),
    );

    const res = await broadcastToMembers(c.client, { title: "Hi", body: "Body" });
    expect(res.ok).toBe(true);
    expect(res.recipientCount).toBe(2);

    const insert = c.callsFor("notifications", "insert")[0];
    const rows = insert.payload as Array<{ member_id: string }>;
    expect(rows.map((r) => r.member_id).sort()).toEqual(["m1", "m3"]);
  });

  it("includes every member when nobody opted out", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }, { id: "m2" }] },
        "notification_preferences:select": { data: [] },
      }),
    );
    const res = await broadcastToMembers(c.client, { title: "Hi" });
    expect(res.recipientCount).toBe(2);
  });

  it("filters profiles by approved account_status by default", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }] },
        "notification_preferences:select": { data: [] },
      }),
    );
    await broadcastToMembers(c.client, { title: "Hi" });
    const sel = c.callsFor("profiles", "select")[0];
    expect(sel.filters).toContainEqual({ col: "account_status", val: ["approved"] });
  });

  it("includes all statuses when accountStatuses is null", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }] },
        "notification_preferences:select": { data: [] },
      }),
    );
    await broadcastToMembers(c.client, { title: "Hi" }, { accountStatuses: null });
    const sel = c.callsFor("profiles", "select")[0];
    expect(sel.filters.find((f) => f.col === "account_status")).toBeUndefined();
  });

  it("queries opted-out via abcac_announcements = false", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }] },
        "notification_preferences:select": { data: [] },
      }),
    );
    await broadcastToMembers(c.client, { title: "Hi" });
    const sel = c.callsFor("notification_preferences", "select")[0];
    expect(sel.filters).toContainEqual({ col: "abcac_announcements", val: false });
  });
});

describe("broadcastToMembers — insert payload shape", () => {
  it("one row per recipient with correct category/title/body/link", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }, { id: "m2" }] },
        "notification_preferences:select": { data: [] },
      }),
    );
    await broadcastToMembers(c.client, {
      title: "  Policy update  ",
      body: "  Details here  ",
      link: "/account/messages",
    });
    const rows = c.callsFor("notifications", "insert")[0].payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      member_id: "m1",
      category: "announcement", // default
      title: "Policy update", // trimmed
      body: "Details here", // trimmed
      link: "/account/messages",
    });
  });

  it("defaults body and link to null when omitted; honors a custom category", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }] },
        "notification_preferences:select": { data: [] },
      }),
    );
    await broadcastToMembers(c.client, { title: "T", category: "general" });
    const rows = c.callsFor("notifications", "insert")[0].payload as Array<Record<string, unknown>>;
    expect(rows[0]).toEqual({ member_id: "m1", category: "general", title: "T", body: null, link: null });
  });
});

describe("broadcastToMembers — empty + validation", () => {
  it("no members → no insert, recipientCount 0, ok true", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [] },
        "notification_preferences:select": { data: [] },
      }),
    );
    const res = await broadcastToMembers(c.client, { title: "Hi" });
    expect(res).toMatchObject({ ok: true, recipientCount: 0 });
    expect(c.callsFor("notifications", "insert")).toHaveLength(0);
  });

  it("all members opted out → no insert, recipientCount 0", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }, { id: "m2" }] },
        "notification_preferences:select": { data: [{ member_id: "m1" }, { member_id: "m2" }] },
      }),
    );
    const res = await broadcastToMembers(c.client, { title: "Hi" });
    expect(res.recipientCount).toBe(0);
    expect(c.callsFor("notifications", "insert")).toHaveLength(0);
  });

  it("rejects a blank title without querying", async () => {
    const c = makeClient(ADMIN, resolver({}));
    const res = await broadcastToMembers(c.client, { title: "   " });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("missing_title");
    expect(c.callsFor("profiles", "select")).toHaveLength(0);
  });
});

describe("broadcastToMembers — best-effort error handling", () => {
  it("returns {ok:false} without throwing when the insert errors", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { data: [{ id: "m1" }] },
        "notification_preferences:select": { data: [] },
        "notifications:insert": { error: { message: "boom" } },
      }),
    );
    const res = await broadcastToMembers(c.client, { title: "Hi" });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("boom");
  });

  it("returns {ok:false} when the profiles lookup errors", async () => {
    const c = makeClient(
      ADMIN,
      resolver({
        "profiles:select": { error: { message: "db_down" } },
      }),
    );
    const res = await broadcastToMembers(c.client, { title: "Hi" });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("db_down");
  });

  it("does not throw when the client itself throws (caller can swallow)", async () => {
    const throwing = {
      auth: { getUser: async () => ({ data: { user: ADMIN }, error: null }) },
      from: () => {
        throw new Error("kaboom");
      },
    } as never;
    const res = await broadcastToMembers(throwing, { title: "Hi" });
    expect(res.ok).toBe(false);
    expect(res.recipientCount).toBe(0);
  });
});
