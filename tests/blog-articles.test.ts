import { describe, it, expect } from "vitest";
import { getArticles, getArticle } from "@/lib/blog";

describe("getArticles", () => {
  it("loads the markdown articles from content/blog", () => {
    expect(getArticles().length).toBeGreaterThanOrEqual(10);
  });

  it("every article has full SEO fields and a featured image path", () => {
    for (const a of getArticles()) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(a.title.length).toBeGreaterThan(10);
      expect(a.metaDescription.length).toBeGreaterThan(40);
      expect(a.category.length).toBeGreaterThan(0);
      expect(a.image).toMatch(/^\/blog\/.+\.png$/);
      expect(a.imageAlt.length).toBeGreaterThan(0);
      expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("is sorted newest first", () => {
    const articles = getArticles();
    for (let i = 0; i < articles.length - 1; i++) {
      expect(articles[i].date >= articles[i + 1].date).toBe(true);
    }
  });

  it("strips the duplicate leading H1 from the body", () => {
    for (const a of getArticles()) {
      expect(a.body.startsWith("# ")).toBe(false);
      expect(a.body.length).toBeGreaterThan(500);
    }
  });
});

describe("getArticle", () => {
  it("finds an article by slug", () => {
    const first = getArticles()[0];
    expect(getArticle(first.slug)?.title).toBe(first.title);
  });
  it("returns undefined for unknown slug", () => {
    expect(getArticle("nope")).toBeUndefined();
  });
  it("article slugs never collide with announcement slugs", async () => {
    const { getPosts } = await import("@/lib/blog");
    const postSlugs = new Set(getPosts().map((p) => p.slug));
    for (const a of getArticles()) expect(postSlugs.has(a.slug)).toBe(false);
  });
});
