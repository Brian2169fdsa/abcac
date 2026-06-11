import { describe, it, expect } from "vitest";
import { makeClient } from "./helpers/supabase-fake";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationsRead,
  markAllNotificationsRead,
  categoryMeta,
  CATEGORY_META,
} from "@/lib/notifications";

const USER = { id: "m1" };

describe("fetchNotifications", () => {
  it("returns rows and applies the unreadOnly filter", async () => {
    const rows = [{ id: "n1", member_id: "m1", category: "billing", title: "Invoice", read_at: null }];
    const c = makeClient(USER, (t) => (t === "notifications" ? { data: rows } : { data: null }));
    const out = await fetchNotifications(c.client, { unreadOnly: true, limit: 10 });
    expect(out).toEqual(rows);
    const call = c.callsFor("notifications", "select")[0];
    expect(call.filters).toContainEqual({ col: "read_at", val: null }); // .is("read_at", null)
  });

  it("returns [] when there is no data", async () => {
    const c = makeClient(USER, () => ({ data: null }));
    expect(await fetchNotifications(c.client)).toEqual([]);
  });
});

describe("fetchUnreadCount", () => {
  it("issues a head/count query and coalesces a missing count to 0", async () => {
    const c = makeClient(USER, () => ({ data: null }));
    expect(await fetchUnreadCount(c.client)).toBe(0);
    const call = c.callsFor("notifications", "select")[0];
    expect(call.filters).toContainEqual({ col: "read_at", val: null });
  });
});

describe("markNotificationsRead", () => {
  it("no-ops on an empty id list without writing", async () => {
    const c = makeClient(USER, () => ({ data: null }));
    const res = await markNotificationsRead(c.client, []);
    expect(res.ok).toBe(true);
    expect(c.callsFor("notifications", "update")).toHaveLength(0);
  });

  it("fails when unauthenticated", async () => {
    const c = makeClient(null, () => ({ data: null }));
    const res = await markNotificationsRead(c.client, ["n1"]);
    expect(res.ok).toBe(false);
    expect(res.error).toBe("not_authenticated");
  });

  it("updates read_at scoped to the member + unread + given ids", async () => {
    const c = makeClient(USER, () => ({ data: null, error: null }));
    const res = await markNotificationsRead(c.client, ["n1", "", "n2"]);
    expect(res.ok).toBe(true);
    const upd = c.callsFor("notifications", "update")[0];
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    expect(upd.filters).toContainEqual({ col: "read_at", val: null });
    expect(upd.filters).toContainEqual({ col: "id", val: ["n1", "n2"] }); // blanks filtered out
    expect((upd.payload as { read_at?: string }).read_at).toBeTypeOf("string");
  });
});

describe("markAllNotificationsRead", () => {
  it("updates all unread rows for the member", async () => {
    const c = makeClient(USER, () => ({ data: null, error: null }));
    const res = await markAllNotificationsRead(c.client);
    expect(res.ok).toBe(true);
    const upd = c.callsFor("notifications", "update")[0];
    expect(upd.filters).toContainEqual({ col: "member_id", val: "m1" });
    expect(upd.filters).toContainEqual({ col: "read_at", val: null });
  });

  it("fails when unauthenticated", async () => {
    const c = makeClient(null, () => ({ data: null }));
    expect((await markAllNotificationsRead(c.client)).ok).toBe(false);
  });
});

describe("categoryMeta", () => {
  it("maps known categories and falls back to general", () => {
    expect(categoryMeta("billing")).toBe(CATEGORY_META.billing);
    expect(categoryMeta("nope")).toBe(CATEGORY_META.general);
  });
});
