import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { getPosts, getArticles } from "@/lib/blog";

export const metadata: Metadata = {
  title: "ABCAC News & Insights",
  description:
    "Guides, policy updates, and career resources for Arizona addiction counseling professionals — plus announcements from the Arizona Board for Certification of Addiction Counselors.",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogPage() {
  const articles = getArticles();
  const posts = getPosts();
  return (
    <>
      <PageHero
        eyebrow="News & Insights"
        title="ABCAC News & Insights"
        intro="Guides, policy updates, and career resources for Arizona's addiction counseling professionals."
      />
      {articles.length > 0 && (
        <Section>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-brand"
              >
                <div className="relative aspect-[1200/630] w-full">
                  <Image
                    src={a.image}
                    alt={a.imageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">
                    {a.category} · {a.readingTime}
                  </p>
                  <h3 className="mt-2 text-lg">{a.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted">{a.metaDescription}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                    Read article <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
      <Section title="Board announcements" intro="Official updates from ABCAC.">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="flex h-full flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-brand"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">{fmt(p.date)}</p>
              <h3 className="mt-2 text-lg">{p.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{p.excerpt}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                Read more <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
