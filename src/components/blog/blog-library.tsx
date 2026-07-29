"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { BlogCard } from "@/components/blog/blog-card";
import type { BlogPostSummary } from "@/lib/blog";
import { cn } from "@/lib/utils";

interface BlogLibraryProps {
  posts: BlogPostSummary[];
  categories: string[];
}

export function BlogLibrary({ posts, categories }: BlogLibraryProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return posts.filter((post) => {
      const categoryMatches = activeCategory === "All" || post.category === activeCategory;
      const queryMatches =
        !normalizedQuery ||
        [post.title, post.excerpt, post.category, ...post.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, posts, query]);

  return (
    <div>
      <div className="flex flex-col gap-5 rounded-[1.5rem] border border-ink/10 bg-surface p-4 shadow-[0_20px_60px_-48px_rgba(13,34,63,0.65)] sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search credentials, exams, compliance, or career topics"
            className="h-12 w-full rounded-xl border border-ink/10 bg-surface pl-11 pr-11 text-sm text-ink shadow-sm outline-none transition placeholder:text-muted/75 focus:border-brand/45 focus:ring-4 focus:ring-brand/10"
            aria-label="Search the ABCAC knowledge center"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-bg hover:text-ink"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink">Filter by topic</p>
            <p className="text-xs font-semibold text-muted">{posts.length} resources</p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Filter articles by category">
            {["All", ...categories].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-left text-xs font-bold leading-tight transition",
                  activeCategory === category
                    ? "border-brand bg-brand text-white shadow-sm"
                    : "border-ink/10 bg-bg text-muted hover:border-brand/25 hover:bg-brand/[0.04] hover:text-brand",
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 text-sm text-muted">
        <p>
          <span className="font-bold text-ink">{visiblePosts.length}</span>{" "}
          {visiblePosts.length === 1 ? "article" : "articles"}
        </p>
        {activeCategory !== "All" && (
          <button type="button" onClick={() => setActiveCategory("All")} className="font-bold text-brand hover:text-brand-600">
            Clear filter
          </button>
        )}
      </div>

      {visiblePosts.length > 0 ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-7">
          {visiblePosts.map((post) => <BlogCard key={post.slug} post={post} />)}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-ink/15 bg-surface px-6 py-16 text-center">
          <h3>No articles matched that search</h3>
          <p className="mt-2 text-sm text-muted">Try a broader topic or clear the active category.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveCategory("All");
            }}
            className="mt-5 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            Show all articles
          </button>
        </div>
      )}
    </div>
  );
}
