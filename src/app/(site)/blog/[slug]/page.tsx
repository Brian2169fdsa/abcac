import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getPost, getPosts, getArticle, getArticles } from "@/lib/blog";
import { ArticleBody } from "@/components/article-body";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function generateStaticParams() {
  return [
    ...getArticles().map((a) => ({ slug: a.slug })),
    ...getPosts().map((p) => ({ slug: p.slug })),
  ];
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const article = getArticle(params.slug);
  if (article) {
    return {
      title: article.title,
      description: article.metaDescription,
      alternates: { canonical: `${base}/blog/${article.slug}` },
      openGraph: {
        title: article.title,
        description: article.metaDescription,
        type: "article",
        publishedTime: article.date,
        url: `${base}/blog/${article.slug}`,
        images: [{ url: `${base}${article.image}`, width: 1200, height: 630, alt: article.imageAlt }],
      },
      twitter: { card: "summary_large_image", title: article.title, description: article.metaDescription },
    };
  }
  const post = getPost(params.slug);
  if (!post) return { title: "Not found" };
  return { title: post.title, description: post.excerpt };
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const article = getArticle(params.slug);
  if (article) {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: article.title,
      description: article.metaDescription,
      datePublished: article.date,
      author: { "@type": "Organization", name: article.author },
      publisher: { "@type": "Organization", name: "Arizona Board for Certification of Addiction Counselors" },
      image: `${base}${article.image}`,
      mainEntityOfPage: `${base}/blog/${article.slug}`,
    };
    return (
      <article className="mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <Link href="/blog" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All articles
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-strong">
          {article.category} · {fmt(article.date)} · {article.readingTime} read
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl">{article.title}</h1>
        <div className="relative mt-6 aspect-[1200/630] w-full overflow-hidden rounded-2xl border border-line">
          <Image src={article.image} alt={article.imageAlt} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        </div>
        <ArticleBody markdown={article.body} />
        <div className="mt-10 rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-display text-lg font-bold text-ink">Ready to advance your credential?</h2>
          <p className="mt-2 text-sm text-muted">
            ABCAC certifies Arizona&apos;s addiction professionals through IC&amp;RC-recognized credentials. Start an
            application, register for an exam, or manage your renewal from the member portal.
          </p>
          <Link href="/account" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
            Go to the member portal <span aria-hidden>→</span>
          </Link>
        </div>
      </article>
    );
  }

  const post = getPost(params.slug);
  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-2xl px-5 py-10 md:px-8 md:py-14">
      <Link href="/blog" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All news
      </Link>
      <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">{fmt(post.date)}</p>
      <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl">{post.title}</h1>
      <div className="mt-6 space-y-4 text-base leading-relaxed text-muted md:text-lg [&_img]:h-auto [&_img]:max-w-full [&_iframe]:max-w-full">
        {post.body.map((para, i) => <p key={i}>{para}</p>)}
      </div>
    </article>
  );
}
