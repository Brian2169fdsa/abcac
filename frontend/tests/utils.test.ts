import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy classes and omits falsy values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("deduplicates conflicting Tailwind classes via tailwind-merge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
