import { describe, it, expect } from "vitest";
import { getPosts, getPost } from "@/lib/blog";

describe("getPosts", () => {
  it("returns a non-empty array", () => {
    const posts = getPosts();
    expect(posts.length).toBeGreaterThan(0);
  });

  it("posts are sorted by date descending (newest first)", () => {
    const posts = getPosts();
    for (let i = 0; i < posts.length - 1; i++) {
      expect(posts[i].date >= posts[i + 1].date).toBe(true);
    }
  });
});

describe("getPost", () => {
  it("returns a post for an existing slug (derived from getPosts data)", () => {
    const posts = getPosts();
    const existingSlug = posts[0].slug;
    const post = getPost(existingSlug);
    expect(post).toBeDefined();
    expect(post!.slug).toBe(existingSlug);
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(getPost("nope")).toBeUndefined();
  });
});
