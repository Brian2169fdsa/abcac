import fs from "fs";
import path from "path";

export interface Post {
  slug: string;
  title: string;
  date: string;        // ISO
  excerpt: string;
  body: string[];      // paragraphs
}

/** Long-form SEO article sourced from a markdown file in content/blog. */
export interface Article {
  slug: string;
  title: string;
  date: string;            // ISO
  category: string;
  tags: string[];
  author: string;
  readingTime: string;     // e.g. "6 min"
  metaDescription: string;
  imageAlt: string;
  image: string;           // /blog/<file>.png
  body: string;            // markdown (without the duplicate H1)
}

// Real ABCAC announcements (sourced from current board communications).
export const POSTS: Post[] = [
  {
    slug: "digital-certificates",
    title: "ABCAC is going digital: certificates now issued electronically",
    date: "2026-01-15",
    excerpt:
      "ABCAC is transitioning to a digital certificate system. Paper copies will no longer be automatically mailed.",
    body: [
      "ABCAC is transitioning to a digital certificate system. Beginning immediately, paper copies of certificates will no longer be automatically mailed.",
      "All certification recipients will receive an official digital certificate upon approval or renewal, available to download from the member portal.",
      "If you would like to receive a printed copy of your certificate, one can be requested for a $25 processing and mailing fee.",
      "This change allows ABCAC to deliver certificates faster, reduce administrative processing time, and support environmentally responsible practices. Questions? Contact our office at abcac@abcac.org.",
    ],
  },
  {
    slug: "certification-sync",
    title: "Certification Sync: one renewal date for all your credentials",
    date: "2026-02-01",
    excerpt:
      "Hold multiple ABCAC credentials? Align them into a single, unified renewal cycle for $15/month forward.",
    body: [
      "If you hold multiple ABCAC certifications — such as CADAC, CCJP, or AADC — you can now align their renewal dates into one easy, unified cycle.",
      "Certification Sync costs a one-time $15 for each month moved forward. It eliminates staggered renewal dates so you can manage all your certifications together, save time, and stay compliant.",
      "Start your sync from the member portal: count the months needed to align your certifications, complete payment securely online, and upload your sync form to finalize your request.",
    ],
  },
  {
    slug: "icrc-exam-prep",
    title: "Preparing for your IC&RC certification exam",
    date: "2026-03-10",
    excerpt:
      "Computer-based testing, 150 questions, a 3-hour limit — here's what to expect and how to prepare.",
    body: [
      "The IC&RC exam is delivered via Computer-Based Testing (CBT) at IQT centers. It consists of 150 multiple-choice questions (125 scored plus 25 pretest) with a 3-hour time limit. If a retake is needed, it may be taken after a minimum of 90 days (which may be longer per member board).",
      "IC&RC provides official candidate guides with content outlines and sample questions, recommended study materials, and online practice exams for ADC, AADC, Clinical Supervisor, Prevention Specialist, Peer Recovery, and more.",
      "ABCAC does not sell or distribute these materials — all resources are hosted by IC&RC and subject to their pricing and terms. Ready to register? Visit the Testing page to choose in-person or remote-proctored testing.",
    ],
  },
];

export function getPosts() {
  return [...POSTS].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}
export function getPost(slug: string) {
  return POSTS.find((p) => p.slug === slug);
}

// ─── Markdown articles (content/blog/*.md) ───────────────────────────────────

const ARTICLE_DIR = path.join(process.cwd(), "content", "blog");

/** Minimal frontmatter parser for our own files: `key: "value"` / `key: [..]`. */
function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string | string[]> = {};
  for (const line of match[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (value.startsWith("[")) {
      try { meta[key] = JSON.parse(value.replace(/'/g, '"')) as string[]; continue; } catch { /* fall through */ }
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[key] = value;
  }
  return { meta, body: raw.slice(match[0].length) };
}

let articleCache: Article[] | null = null;

function loadArticles(): Article[] {
  if (articleCache) return articleCache;
  let files: string[] = [];
  try {
    files = fs.readdirSync(ARTICLE_DIR).filter((f) => f.endsWith(".md"));
  } catch {
    return (articleCache = []);
  }
  const articles: Article[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ARTICLE_DIR, file), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : "");
    if (!str("slug") || !str("title")) continue;
    articles.push({
      slug: str("slug"),
      title: str("title"),
      date: str("date"),
      category: str("category"),
      tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
      author: str("author") || "ABCAC Editorial Team",
      readingTime: str("reading_time"),
      metaDescription: str("meta_description"),
      imageAlt: str("featured_image_alt"),
      image: `/blog/${file.replace(/\.md$/, "")}.png`,
      // The page renders the title itself — drop the duplicate leading H1.
      body: body.replace(/^\s*# .*\n/, "").trim(),
    });
  }
  articleCache = articles.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return articleCache;
}

export function getArticles() {
  return loadArticles();
}
export function getArticle(slug: string) {
  return loadArticles().find((a) => a.slug === slug);
}
