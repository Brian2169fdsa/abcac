import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock3, FileCheck2, UserRound } from "lucide-react";
import { ArticleContent } from "@/components/blog/article-content";
import { BlogCard } from "@/components/blog/blog-card";
import { CtaButton } from "@/components/cta-button";
import { getKnowledgePosts, getPost, getPostHeadings } from "@/lib/blog";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return getKnowledgePosts().map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug);
  if (!post) return { title: "Article not found" };

  const canonical = `${base}/blog/${post.slug}`;
  const image = post.featuredImage.startsWith("http")
    ? post.featuredImage
    : `${base}${post.featuredImage}`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      url: canonical,
      images: [{ url: image, width: 1200, height: 630, alt: post.featuredImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [image],
    },
  };
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const relatedPosts = getKnowledgePosts()
    .filter((candidate) => candidate.slug !== post.slug)
    .sort((first, second) => {
      const firstMatches = first.category === post.category ? 1 : 0;
      const secondMatches = second.category === post.category ? 1 : 0;
      return secondMatches - firstMatches;
    })
    .slice(0, 3)
    .map(({ content: _content, body: _body, ...summary }) => summary);
  const headings = getPostHeadings(post);
  const canonical = `${base}/blog/${post.slug}`;
  const image = post.featuredImage.startsWith("http")
    ? post.featuredImage
    : `${base}${post.featuredImage}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "Arizona Board for Certification of Addiction Counselors",
    },
    image,
    mainEntityOfPage: canonical,
  };

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="relative isolate overflow-hidden border-b border-ink/10 bg-info text-white">
        <div className="site-grid absolute inset-0 -z-20 opacity-25" aria-hidden />
        <div className="site-noise absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:px-8">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-white/65 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Knowledge Center
          </Link>
          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-white/60">
            <span className="rounded-full bg-brand px-3 py-1.5 text-white">{post.category}</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
          </div>
          <h1 className="mt-5 max-w-4xl text-white">{post.title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/68 sm:text-lg">{post.excerpt}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/65">
            <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" aria-hidden /> {post.author}</span>
            <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden /> {post.readingTime} read</span>
            {post.regulatoryReview && (
              <span className="inline-flex items-center gap-2"><FileCheck2 className="h-4 w-4" aria-hidden /> Regulatory review recommended</span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-content px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <div className="relative aspect-[16/8.2] overflow-hidden rounded-[1.5rem] border border-ink/10 bg-info shadow-[0_34px_80px_-50px_rgba(13,34,63,0.65)] sm:rounded-[2rem]">
          <Image
            src={post.featuredImage}
            alt={post.featuredImageAlt}
            fill
            priority
            sizes="(min-width: 1152px) 72rem, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-info/20 to-transparent" aria-hidden />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-content gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_17rem] lg:px-8 lg:py-20">
        <div className="min-w-0 lg:pl-8">
          <ArticleContent content={post.content} />

          {post.regulatoryReview && (
            <div className="mt-12 rounded-[1.5rem] border border-brand/15 bg-brand/[0.045] p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
                  <FileCheck2 className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg">Verify current requirements before acting</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    Regulations, fees, and board processes can change. Confirm the latest requirements with ABCAC and the relevant licensing authority before making credentialing or compliance decisions.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="order-first lg:order-none">
          <div className="space-y-5 lg:sticky lg:top-28">
            {headings.length > 0 && (
              <nav className="rounded-[1.35rem] border border-ink/10 bg-surface p-5 shadow-[0_22px_55px_-45px_rgba(13,34,63,0.7)]" aria-label="Article sections">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">In this article</p>
                <ol className="mt-4 space-y-1">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className={`block rounded-lg py-2 text-sm leading-snug text-muted transition hover:bg-bg hover:text-brand ${
                          heading.level === 3 ? "pl-4 pr-2" : "px-2 font-semibold"
                        }`}
                      >
                        {heading.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className="overflow-hidden rounded-[1.35rem] bg-info p-5 text-white shadow-[0_22px_55px_-45px_rgba(13,34,63,0.8)]">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Your next step</p>
              <h3 className="mt-3 text-xl text-white">Manage your ABCAC journey online.</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                Start an application, track progress, or return to work already in progress.
              </p>
              <CtaButton href="/account" className="mt-5 w-full bg-white text-info hover:bg-white/90">
                Open Member Portal <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
            </div>
          </div>
        </aside>
      </div>

      <section className="border-t border-ink/10 bg-surface">
        <div className="mx-auto w-full max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Continue reading</p>
              <h2 className="mt-3 text-3xl">Related guidance</h2>
            </div>
            <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-bold text-brand hover:text-brand-600">
              View all articles <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {relatedPosts.map((relatedPost) => <BlogCard key={relatedPost.slug} post={relatedPost} />)}
          </div>
        </div>
      </section>
    </article>
  );
}
