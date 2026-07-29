import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, Sparkles } from "lucide-react";
import { BlogLibrary } from "@/components/blog/blog-library";
import { CtaButton } from "@/components/cta-button";
import { getCategories, getPostSummaries } from "@/lib/blog";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Knowledge Center",
  description:
    "Practical guidance for Arizona addiction counselors on certification, licensure, testing, compliance, treatment, and career growth.",
  alternates: { canonical: `${base}/blog` },
};

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogPage() {
  const posts = getPostSummaries();
  const featuredPost = posts[0];

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-ink/10 bg-info text-white">
        <div className="site-grid absolute inset-0 -z-20 opacity-30" aria-hidden />
        <div className="site-noise absolute inset-0 -z-10" aria-hidden />
        <div className="absolute -right-24 -top-32 -z-10 h-96 w-96 rounded-full border-[70px] border-white/[0.045]" aria-hidden />
        <div className="mx-auto grid w-full max-w-content gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:px-8 lg:py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white/75">
              <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden />
              ABCAC Knowledge Center
            </div>
            <h1 className="mt-6 max-w-xl text-[clamp(2.75rem,4vw,3.75rem)] leading-[0.98] tracking-[-0.04em] text-white">
              Practical guidance for Arizona addiction professionals.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/68 sm:text-lg">
              Understand credentials, prepare for testing, follow policy changes, and strengthen the work you do every day.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5 text-sm text-white/65">
              <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4" aria-hidden /> {posts.length} resources</span>
              <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />
              <span>Written for Arizona professionals</span>
            </div>
          </div>

          {featuredPost && (
            <article className="group overflow-hidden rounded-[2rem] border border-white/15 bg-surface text-ink shadow-[0_38px_90px_-50px_rgba(0,0,0,0.9)]">
              <Link
                href={`/blog/${featuredPost.slug}`}
                className="block h-full"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-info">
                  <Image
                    src={featuredPost.featuredImage}
                    alt={featuredPost.featuredImageAlt}
                    fill
                    priority
                    sizes="(min-width: 1024px) 52vw, 100vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.025]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-info/35 via-transparent to-transparent" aria-hidden />
                  <span className="absolute left-5 top-5 rounded-full bg-brand px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-white shadow-lg">
                    Featured
                  </span>
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-7">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
                    <span className="text-brand">{featuredPost.category}</span>
                    <span className="h-1 w-1 rounded-full bg-brand/35" aria-hidden />
                    <time dateTime={featuredPost.date}>{formatDate(featuredPost.date)}</time>
                    <span className="h-1 w-1 rounded-full bg-brand/35" aria-hidden />
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden /> {featuredPost.readingTime}</span>
                  </div>
                  <h2 className="mt-4 text-2xl leading-tight text-ink">{featuredPost.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted sm:text-base">{featuredPost.excerpt}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand">
                    Read the guide <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            </article>
          )}
        </div>
      </section>

      <section id="article-library" className="relative scroll-mt-24">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mb-10 max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-px w-8 bg-brand" aria-hidden />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Explore the library</p>
            </div>
            <h2>Clear answers for the work ahead.</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              Browse current guidance on Arizona credentialing, IC&amp;RC testing, professional practice, and the issues shaping addiction services.
            </p>
          </div>
          <BlogLibrary posts={posts} categories={getCategories()} />
        </div>
      </section>

      <section className="border-t border-ink/10 bg-surface">
        <div className="mx-auto grid w-full max-w-content gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Ready when you are</p>
            <h2 className="mt-3 text-3xl">Turn what you learned into your next step.</h2>
            <p className="mt-3 max-w-2xl text-muted">
              Compare credentials, start an application, or sign in to continue work already in progress.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <CtaButton href="/initial-certification" size="lg">Explore Certification</CtaButton>
            <CtaButton href="/account" variant="outline" size="lg">Open Member Portal</CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
