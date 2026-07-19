import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";
import { getPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "ABCAC News",
  description: "Announcements and updates from the Arizona Board for Certification of Addiction Counselors.",
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogPage() {
  const posts = getPosts();
  return (
    <>
      <PageHero eyebrow="News & Updates" title="ABCAC News" intro="Announcements and updates for certified addiction counseling professionals in Arizona." />
      <Section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="flex h-full flex-col rounded-xl border border-line bg-surface p-6 transition-colors hover:border-brand">
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
