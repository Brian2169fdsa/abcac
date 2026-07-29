import fs from "node:fs";
import path from "node:path";

export interface Post {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  body: string[];
}

export interface Article {
  slug: string;
  title: string;
  date: string;
  category: string;
  tags: string[];
  targetReader: string;
  author: string;
  readingTime: string;
  metaDescription: string;
  imageAlt: string;
  image: string;
  regulatoryReview: boolean;
  body: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  category: string;
  tags: string[];
  targetReader: string;
  author: string;
  readingTime: string;
  featuredImage: string;
  featuredImageAlt: string;
  regulatoryReview: boolean;
  content: string;
  body: string[];
}

type StoredBlogPost = Omit<BlogPost, "body">;

export type BlogPostSummary = Omit<BlogPost, "content" | "body">;

export interface BlogHeading {
  id: string;
  title: string;
  level: 2 | 3;
}

const articleDirectory = path.join(process.cwd(), "content", "blog");

const legacyPosts: StoredBlogPost[] = [
  {
    slug: "digital-certificates",
    title: "ABCAC is going digital: certificates now issued electronically",
    date: "2026-01-15",
    excerpt:
      "ABCAC is transitioning to a digital certificate system. Paper copies will no longer be automatically mailed.",
    category: "ABCAC Updates",
    tags: ["ABCAC", "digital certificates", "member portal"],
    targetReader: "Current ABCAC certificate holders",
    author: "ABCAC",
    readingTime: "3 min",
    featuredImage: "/brand/cadac-certificate.png",
    featuredImageAlt: "ABCAC digital certificate example",
    regulatoryReview: false,
    content: `# ABCAC is going digital: certificates now issued electronically

ABCAC is transitioning to a digital certificate system. Beginning immediately, paper copies of certificates will no longer be automatically mailed.

All certification recipients will receive an official digital certificate upon approval or renewal, available to download from the member portal.

## Requesting a printed copy

If you would like to receive a printed copy of your certificate, one can be requested for a **$25 processing and mailing fee**.

This change allows ABCAC to deliver certificates faster, reduce administrative processing time, and support environmentally responsible practices.

### Questions?

Contact our office at [abcac@abcac.org](mailto:abcac@abcac.org).`,
  },
  {
    slug: "certification-sync",
    title: "Certification Sync: one renewal date for all your credentials",
    date: "2026-02-01",
    excerpt:
      "Hold multiple ABCAC credentials? Align them into a single, unified renewal cycle and simplify future renewals.",
    category: "ABCAC Updates",
    tags: ["ABCAC", "certification sync", "renewal"],
    targetReader: "Professionals holding multiple ABCAC credentials",
    author: "ABCAC",
    readingTime: "3 min",
    featuredImage: "/brand/cert-sync-video-poster.png",
    featuredImageAlt: "ABCAC certification synchronization service",
    regulatoryReview: false,
    content: `# Certification Sync: one renewal date for all your credentials

If you hold multiple ABCAC certifications — such as CADAC, CCJP, or AADC — you can align their renewal dates into one easy, unified cycle.

## How synchronization helps

Certification Sync costs a one-time **$15 for each month moved forward**. It eliminates staggered renewal dates so you can manage all your certifications together, save time, and stay compliant.

## Start your request

Visit the [Certification Sync page](/certification-sync) to count the months needed to align your certifications, complete payment securely online, and submit your request.`,
  },
  {
    slug: "icrc-exam-prep",
    title: "Preparing for your IC&RC certification exam",
    date: "2026-03-10",
    excerpt:
      "Computer-based testing, 150 questions, a 3-hour limit — here is what to expect and how to prepare.",
    category: "Exams & Testing",
    tags: ["IC&RC", "exam preparation", "testing"],
    targetReader: "ABCAC certification exam candidates",
    author: "ABCAC",
    readingTime: "4 min",
    featuredImage: "/brand/testing-hero.png",
    featuredImageAlt: "Addiction counselor preparing for a certification exam",
    regulatoryReview: false,
    content: `# Preparing for your IC&RC certification exam

The IC&RC exam is delivered through computer-based testing. It consists of **150 multiple-choice questions** — 125 scored questions plus 25 pretest questions — with a three-hour time limit.

## Prepare with official resources

IC&RC provides official candidate guides with content outlines and sample questions, recommended study materials, and online practice exams for ADC, AADC, Clinical Supervisor, Prevention Specialist, Peer Recovery, and more.

ABCAC does not sell or distribute these materials. All resources are hosted by IC&RC and subject to its pricing and terms.

## Ready to register?

Visit the [Testing page](/testing) to review your options and begin pre-registration.`,
  },
];

function parseScalar(value: string) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed.replace(/'/g, '"')) as string[];
    } catch {
      return trimmed;
    }
  }
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseMarkdownFile(fileName: string): Article {
  const source = fs.readFileSync(path.join(articleDirectory, fileName), "utf8");
  const match = source.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

  if (!match) {
    throw new Error(`Invalid blog frontmatter: ${fileName}`);
  }

  const fields: Record<string, string | string[] | boolean> = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields[line.slice(0, separator).trim()] = parseScalar(line.slice(separator + 1));
  }

  const value = (key: string) => typeof fields[key] === "string" ? fields[key] as string : "";

  return {
    slug: value("slug"),
    title: value("title"),
    date: value("date"),
    category: value("category"),
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    targetReader: value("target_reader"),
    author: value("author") || "ABCAC Editorial Team",
    readingTime: value("reading_time") || "5 min",
    metaDescription: value("meta_description"),
    imageAlt: value("featured_image_alt") || value("title"),
    image: `/blog/${fileName.replace(/\.md$/, "")}.png`,
    regulatoryReview: fields.regulatory_review === true,
    body: match[2].replace(/^\s*# .*\n/, "").trim(),
  };
}

let articleCache: Article[] | null = null;

function loadArticles() {
  if (articleCache) return articleCache;
  if (!fs.existsSync(articleDirectory)) return [];

  articleCache = fs
    .readdirSync(articleDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map(parseMarkdownFile)
    .filter((article) => article.slug && article.title)
    .sort((first, second) => +new Date(second.date) - +new Date(first.date));

  return articleCache;
}

function withBody(post: StoredBlogPost): BlogPost {
  return {
    ...post,
    body: post.content.split(/\n{2,}/).filter(Boolean),
  };
}

function articleToBlogPost(article: Article): BlogPost {
  return {
    slug: article.slug,
    title: article.title,
    date: article.date,
    excerpt: article.metaDescription,
    category: article.category,
    tags: article.tags,
    targetReader: article.targetReader,
    author: article.author,
    readingTime: article.readingTime,
    featuredImage: article.image,
    featuredImageAlt: article.imageAlt,
    regulatoryReview: article.regulatoryReview,
    content: article.body,
    body: article.body.split(/\n{2,}/).filter(Boolean),
  };
}

export const POSTS: Post[] = legacyPosts.map((post) => ({
  slug: post.slug,
  title: post.title,
  date: post.date,
  excerpt: post.excerpt,
  body: post.content.split(/\n{2,}/).filter(Boolean),
}));

export function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[*_`[\]()]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getArticles() {
  return loadArticles();
}

export function getArticle(slug: string) {
  return loadArticles().find((article) => article.slug === slug);
}

export function getPosts() {
  return [...POSTS].sort((first, second) => +new Date(second.date) - +new Date(first.date));
}

export function getKnowledgePosts(): BlogPost[] {
  return [
    ...loadArticles().map(articleToBlogPost),
    ...legacyPosts.map(withBody),
  ].sort((first, second) => +new Date(second.date) - +new Date(first.date));
}

export function getPostSummaries(): BlogPostSummary[] {
  return getKnowledgePosts().map(({ content: _content, body: _body, ...post }) => post);
}

export function getPost(slug: string) {
  return getKnowledgePosts().find((post) => post.slug === slug);
}

export function getCategories() {
  return Array.from(new Set(getKnowledgePosts().map((post) => post.category))).sort();
}

export function getPostHeadings(post: BlogPost): BlogHeading[] {
  return post.content
    .split("\n")
    .flatMap((line) => {
      const match = line.match(/^(##|###)\s+(.+)$/);
      if (!match) return [];
      const title = match[2].replace(/[*_`]/g, "");
      return [{
        id: slugifyHeading(title),
        title,
        level: match[1] === "##" ? 2 : 3,
      } satisfies BlogHeading];
    });
}
