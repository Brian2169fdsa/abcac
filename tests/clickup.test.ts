import { describe, it, expect } from "vitest";
import { buildClickUpTask, clickUpPriority } from "@/lib/clickup";

describe("clickUpPriority", () => {
  it("maps our priorities onto ClickUp's 1-4 scale", () => {
    expect(clickUpPriority("urgent")).toBe(1);
    expect(clickUpPriority("high")).toBe(2);
    expect(clickUpPriority("normal")).toBe(3);
    expect(clickUpPriority("low")).toBe(4);
  });
  it("defaults unknown/missing to normal (3)", () => {
    expect(clickUpPriority(undefined)).toBe(3);
    expect(clickUpPriority(null)).toBe(3);
    expect(clickUpPriority("whenever")).toBe(3);
  });
  it("is case-insensitive", () => {
    expect(clickUpPriority("Urgent")).toBe(1);
    expect(clickUpPriority("HIGH")).toBe(2);
  });
});

describe("buildClickUpTask", () => {
  it("builds name, description with admin link, priority, and tags", () => {
    const task = buildClickUpTask({
      title: "Review testing application",
      detail: "New exam registration from Pat Jones.",
      priority: "high",
      adminUrl: "https://abcac.example/admin/testing/123",
    });
    expect(task.name).toBe("Review testing application");
    expect(task.description).toBe(
      "New exam registration from Pat Jones.\n\nAdmin link: https://abcac.example/admin/testing/123",
    );
    expect(task.priority).toBe(2);
    expect(task.tags).toEqual(["abcac-portal"]);
  });

  it("omits missing detail/link cleanly", () => {
    const task = buildClickUpTask({ title: "Follow up" });
    expect(task.description).toBe("");
    expect(task.priority).toBe(3);
  });

  it("truncates the name to ClickUp's 250-char limit", () => {
    const task = buildClickUpTask({ title: "x".repeat(300) });
    expect(task.name).toHaveLength(250);
  });
});
