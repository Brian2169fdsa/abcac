import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type ResultFor, type QueryResult } from "./helpers/supabase-fake";
import { directoryListingLabel } from "@/lib/directory";

const serverRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverRef.current!.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

import { updateDirectoryListing } from "@/app/(portal)/account/settings/actions";

beforeEach(() => {
  revalidatePath.mockClear();
});

function setup(opts: { user: { id: string } | null; result?: ResultFor }) {
  serverRef.current = makeClient(opts.user, opts.result ?? (() => ({ data: null })));
}

describe("directoryListingLabel", () => {
  it("returns 'Opted out' when opted out", () => {
    expect(directoryListingLabel(true)).toBe("Opted out");
  });
  it("returns 'Listed' when not opted out", () => {
    expect(directoryListingLabel(false)).toBe("Listed");
  });
  it("treats null/undefined as Listed (default not opted out)", () => {
    expect(directoryListingLabel(null)).toBe("Listed");
    expect(directoryListingLabel(undefined)).toBe("Listed");
  });
});

describe("updateDirectoryListing", () => {
  it("rejects when unauthenticated", async () => {
    setup({ user: null });
    expect(await updateDirectoryListing(true)).toEqual({ ok: false, error: "unauthorized" });
    expect(serverRef.current!.callsFor("profiles", "update")).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("opts out: updates directory_opt_out=true scoped to the signed-in member id", async () => {
    setup({ user: { id: "u1" } });
    expect(await updateDirectoryListing(true)).toEqual({ ok: true });

    const upd = serverRef.current!.callsFor("profiles", "update")[0];
    expect(upd.payload).toEqual({ directory_opt_out: true });
    expect(upd.filters).toContainEqual({ col: "id", val: "u1" });
  });

  it("opts in: updates directory_opt_out=false scoped to the member id", async () => {
    setup({ user: { id: "u2" } });
    expect(await updateDirectoryListing(false)).toEqual({ ok: true });

    const upd = serverRef.current!.callsFor("profiles", "update")[0];
    expect(upd.payload).toEqual({ directory_opt_out: false });
    expect(upd.filters).toContainEqual({ col: "id", val: "u2" });
  });

  it("does not target any other member's row", async () => {
    setup({ user: { id: "u1" } });
    await updateDirectoryListing(true);
    const upd = serverRef.current!.callsFor("profiles", "update")[0];
    expect(upd.filters.every((f) => f.col !== "id" || f.val === "u1")).toBe(true);
  });

  it("revalidates the settings path on success", async () => {
    setup({ user: { id: "u1" } });
    await updateDirectoryListing(true);
    expect(revalidatePath).toHaveBeenCalledWith("/account/settings");
  });

  it("surfaces an update error and does not revalidate", async () => {
    const result: ResultFor = (table, op): QueryResult =>
      table === "profiles" && op === "update" ? { error: { message: "denied" } } : { data: null };
    setup({ user: { id: "u1" }, result });
    expect(await updateDirectoryListing(true)).toEqual({ ok: false, error: "denied" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
