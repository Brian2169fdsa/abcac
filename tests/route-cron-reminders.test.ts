// Cron route auth + dispatch: fail-closed when CRON_SECRET is unset (503),
// reject bad/absent bearer (401), and run + return the summary on a match (200).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The route builds an admin client and hands it to the runner; we mock both so
// the test exercises only the auth gating + response shaping.
const runRemindersForAll = vi.fn();
vi.mock("@/lib/reminders-runner", () => ({
  runRemindersForAll: (...args: unknown[]) => runRemindersForAll(...args),
}));

const createSupabaseAdminClient = vi.fn(() => ({ __admin: true }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

import { GET } from "@/app/api/cron/reminders/route";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/reminders", { headers });
}

const ORIGINAL_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  runRemindersForAll.mockReset();
  createSupabaseAdminClient.mockClear();
  createSupabaseAdminClient.mockReturnValue({ __admin: true });
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL_SECRET;
});

describe("cron reminders route — auth gating", () => {
  it("returns 503 (fail closed) when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req({ authorization: "Bearer anything" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "cron_not_configured" });
    // Never even touches the DB / runner.
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(runRemindersForAll).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(runRemindersForAll).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token does not match", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(runRemindersForAll).not.toHaveBeenCalled();
  });

  it("returns 401 when the secret is present but not Bearer-prefixed", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await GET(req({ authorization: "s3cret" }));
    expect(res.status).toBe(401);
  });
});

describe("cron reminders route — authorized run", () => {
  it("returns 200 + the runner summary when the bearer matches", async () => {
    process.env.CRON_SECRET = "s3cret";
    runRemindersForAll.mockResolvedValue({ membersProcessed: 3, remindersSent: 5, emailsSent: 2 });

    const res = await GET(req({ authorization: "Bearer s3cret" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, membersProcessed: 3, remindersSent: 5, emailsSent: 2 });
    // Runs against the admin client it constructed.
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(runRemindersForAll).toHaveBeenCalledTimes(1);
    expect(runRemindersForAll).toHaveBeenCalledWith({ __admin: true });
  });

  it("returns 500 when the runner throws, surfacing the message", async () => {
    process.env.CRON_SECRET = "s3cret";
    runRemindersForAll.mockRejectedValue(new Error("boom"));

    const res = await GET(req({ authorization: "Bearer s3cret" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "boom" });
  });
});
