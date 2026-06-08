import { describe, it, expect } from "vitest";
import {
  roleLabel,
  roleRank,
  isAtLeast,
  isSuperadmin,
  isAdmin,
  type PortalRole,
} from "@/lib/auth/roles";

const TIERS: PortalRole[] = ["member", "admin", "superadmin"];

describe("roleLabel", () => {
  it("returns the human-readable label for each tier", () => {
    expect(roleLabel("member")).toBe("Member");
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("superadmin")).toBe("Superadmin");
  });
});

describe("roleRank", () => {
  it("orders member < admin < superadmin", () => {
    expect(roleRank("member")).toBe(0);
    expect(roleRank("admin")).toBe(1);
    expect(roleRank("superadmin")).toBe(2);
    expect(roleRank("member")).toBeLessThan(roleRank("admin"));
    expect(roleRank("admin")).toBeLessThan(roleRank("superadmin"));
  });
});

describe("isAtLeast", () => {
  it("is true when the role meets or exceeds the minimum", () => {
    expect(isAtLeast("superadmin", "admin")).toBe(true);
    expect(isAtLeast("admin", "admin")).toBe(true);
    expect(isAtLeast("superadmin", "superadmin")).toBe(true);
    expect(isAtLeast("member", "member")).toBe(true);
  });

  it("is false when the role is below the minimum", () => {
    expect(isAtLeast("member", "admin")).toBe(false);
    expect(isAtLeast("admin", "superadmin")).toBe(false);
    expect(isAtLeast("member", "superadmin")).toBe(false);
  });

  it("treats every tier as at least 'member'", () => {
    for (const role of TIERS) {
      expect(isAtLeast(role, "member")).toBe(true);
    }
  });
});

describe("isSuperadmin", () => {
  it("is true only for the superadmin tier", () => {
    expect(isSuperadmin("superadmin")).toBe(true);
    expect(isSuperadmin("admin")).toBe(false);
    expect(isSuperadmin("member")).toBe(false);
  });
});

describe("isAdmin", () => {
  it("is true for admin and superadmin", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("superadmin")).toBe(true);
  });

  it("is false for member", () => {
    expect(isAdmin("member")).toBe(false);
  });
});
