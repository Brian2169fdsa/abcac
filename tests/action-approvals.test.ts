import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeClient, type ResultFor } from "./helpers/supabase-fake";

// Mocks for the Supabase server module — both server (cookie-bound) and admin
// (service-role) clients are swapped for chainable fakes.
const serverRef: { current: ReturnType<typeof makeClient> | null } = { current: null };
const adminRef: { current: ReturnType<typeof makeClient> | null } = { current: null };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => serverRef.current!.client,
  createSupabaseAdminClient: () => adminRef.current!.client,
}));

import { sendApprovalCredentialsEmail } from "@/app/(admin)/admin/approvals/approve-account";

/** Wire up a caller with the given role and a member-email lookup result. */
function setup(opts: {
  user: { id: string } | null;
  callerRole: string | null;
  memberEmail?: string | null;
}) {
  serverRef.current = makeClient(opts.user, (table) => {
    if (table === "profiles") return { data: { portal_role: opts.callerRole } };
    return { data: null };
  });
  const adminResult: ResultFor = (table) => {
    if (table === "profiles") {
      return { data: { email: opts.memberEmail ?? null, first_name: "Pat" } };
    }
    return { data: null };
  };
  adminRef.current = makeClient(opts.user, adminResult);
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
});

describe("sendApprovalCredentialsEmail", () => {
  it("rejects an empty member id", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin" });
    expect(await sendApprovalCredentialsEmail("")).toEqual({ ok: false, error: "bad_request" });
  });

  it("returns unauthorized with no session", async () => {
    setup({ user: null, callerRole: null });
    expect(await sendApprovalCredentialsEmail("m1")).toEqual({ ok: false, error: "unauthorized" });
  });

  it("forbids a plain member caller", async () => {
    setup({ user: { id: "u1" }, callerRole: "member" });
    expect(await sendApprovalCredentialsEmail("m1")).toEqual({ ok: false, error: "forbidden" });
    // Must not even look up the member via the admin client.
    expect(adminRef.current!.callsFor("profiles")).toHaveLength(0);
  });

  it("returns no_email when the member has no email on file", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin", memberEmail: null });
    expect(await sendApprovalCredentialsEmail("m1")).toEqual({ ok: false, error: "no_email" });
  });

  it("admin caller: looks up member by id and returns ok (no-op without Resend key)", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin", memberEmail: "pat@example.com" });
    const fetchSpy = vi.spyOn(global, "fetch");
    expect(await sendApprovalCredentialsEmail("m1")).toEqual({ ok: true });
    // The member lookup uses the admin (service-role) client, filtered by id.
    const lookup = adminRef.current!.callsFor("profiles", "select")[0];
    expect(lookup.filters).toContainEqual({ col: "id", val: "m1" });
    // Without RESEND_API_KEY it never reaches out over the network.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("superadmin caller is also allowed", async () => {
    setup({ user: { id: "u1" }, callerRole: "superadmin", memberEmail: "pat@example.com" });
    expect(await sendApprovalCredentialsEmail("m1")).toEqual({ ok: true });
  });

  it("sends via Resend when configured", async () => {
    setup({ user: { id: "u1" }, callerRole: "admin", memberEmail: "pat@example.com" });
    process.env.RESEND_API_KEY = "re_test";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
    expect(await sendApprovalCredentialsEmail("m1")).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
    fetchSpy.mockRestore();
  });
});
