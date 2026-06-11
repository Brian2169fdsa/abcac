import { describe, it, expect } from "vitest";
import { makeClient } from "./helpers/supabase-fake";
import {
  normalizeCertNumber,
  escapeLike,
  lookupByCertNumber,
  searchDirectory,
  isCurrentlyValid,
  type PublicCredential,
} from "@/lib/directory";

const CRED: PublicCredential = {
  cert_number: "AZ-CADAC-50403",
  cert_type: "CADAC",
  status: "active",
  issued_date: "2024-05-19",
  expiration_date: "2028-05-19",
  full_name: "Linda Tran",
  last_name: "Tran",
};

describe("normalizeCertNumber / escapeLike", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeCertNumber("  az-cadac-50403 ")).toBe("AZ-CADAC-50403");
    expect(normalizeCertNumber("az cadac 50403")).toBe("AZCADAC50403");
  });
  it("escapes ilike wildcards", () => {
    expect(escapeLike("100% O_K")).toBe("100\\% O\\_K");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });
});

describe("lookupByCertNumber", () => {
  it("returns the credential for a match", async () => {
    const c = makeClient(null, (t) => (t === "directory_credentials" ? { data: CRED } : { data: null }));
    const res = await lookupByCertNumber(c.client, " az-cadac-50403 ");
    expect(res).toEqual(CRED);
    const call = c.callsFor("directory_credentials", "select")[0];
    expect(call.filters).toContainEqual({ col: "cert_number", val: "AZ-CADAC-50403" });
  });

  it("returns null for an empty input without querying", async () => {
    const c = makeClient(null, () => ({ data: null }));
    expect(await lookupByCertNumber(c.client, "   ")).toBeNull();
    expect(c.callsFor("directory_credentials")).toHaveLength(0);
  });

  it("returns null when the view has no row (expired/opted-out/unknown)", async () => {
    const c = makeClient(null, () => ({ data: null }));
    expect(await lookupByCertNumber(c.client, "AZ-XXX-00000")).toBeNull();
  });
});

describe("searchDirectory", () => {
  it("applies name + cert_type filters and clamps the page size", async () => {
    const c = makeClient(null, () => ({ data: [CRED] }));
    const res = await searchDirectory(c.client, { name: "tran", certType: "CADAC", limit: 999 });
    expect(res.rows).toEqual([CRED]);
    const call = c.callsFor("directory_credentials", "select")[0];
    expect(call.filters).toContainEqual({ col: "full_name", val: "%tran%" });
    expect(call.filters).toContainEqual({ col: "cert_type", val: "CADAC" });
  });

  it("ignores the 'all' cert type and a blank name (no such filters)", async () => {
    const c = makeClient(null, () => ({ data: [] }));
    await searchDirectory(c.client, { name: "  ", certType: "all" });
    const call = c.callsFor("directory_credentials", "select")[0];
    expect(call.filters.find((f) => f.col === "cert_type")).toBeUndefined();
    expect(call.filters.find((f) => f.col === "full_name")).toBeUndefined();
  });

  it("returns an empty page safely", async () => {
    const c = makeClient(null, () => ({ data: null }));
    expect(await searchDirectory(c.client)).toEqual({ rows: [], total: 0 });
  });
});

describe("isCurrentlyValid", () => {
  const now = new Date("2026-06-11T00:00:00Z");
  it("true for active + future/no expiration", () => {
    expect(isCurrentlyValid(CRED, now)).toBe(true);
    expect(isCurrentlyValid({ ...CRED, expiration_date: null }, now)).toBe(true);
  });
  it("false for non-active or past expiration", () => {
    expect(isCurrentlyValid({ ...CRED, status: "expired" }, now)).toBe(false);
    expect(isCurrentlyValid({ ...CRED, expiration_date: "2020-01-01" }, now)).toBe(false);
  });
});
