import { describe, it, expect } from "vitest";
import { getPosts, getPost } from "@/lib/blog";

describe("getPosts", () => {
  it("returns a non-empty array", () => {
    expect(getPosts().length).toBeGreaterThan(0);
  });

  it("posts are sorted by date descending (newest first)", () => {
    const posts = getPosts();
    for (let i = 0; i < posts.length - 1; i++) {
      expect(posts[i].date >= posts[i + 1].date).toBe(true);
    }
  });
});

describe("getPost", () => {
  it("'digital-certificates' is defined and has a non-empty body array", () => {
    const post = getPost("digital-certificates");
    expect(post).toBeDefined();
    expect(Array.isArray(post!.body)).toBe(true);
    expect(post!.body.length).toBeGreaterThan(0);
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(getPost("does-not-exist")).toBeUndefined();
  });
});
